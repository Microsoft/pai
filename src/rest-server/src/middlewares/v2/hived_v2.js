// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// module dependencies
const axios = require('axios');
const _ = require('lodash');
const createError = require('@pai/utils/error');
const { schemaValidate } = require('@pai/config/v2/hived_v2');
const { resourceUnits } = require('@pai/config/vc');
const { hivedWebserviceUri } = require('@pai/config/launcher');

const convertPriority = (priorityClass = 'test') => {
  // TODO: make it a cluster-wise config
  // allowed range: [-1, 126], default priority 10
  const priorityMap = {
    crit: 120,
    prod: 100,
    test: 10,
    oppo: -1,
  };
  return priorityClass in priorityMap ? priorityMap[priorityClass] : null;
};

const initVcCellInfo = (cellList, vcCellInfo) => {
  for (const cell of cellList) {
    const cellType = cell.cellType;
    if (!(cellType in vcCellInfo)) {
      vcCellInfo[cellType] = { quota: 0, gpu: 0, memory: 0, cpu: 0 };
    }
    if (cell.cellChildren) {
      vcCellInfo[cellType].isLeafCell = false;
      initVcCellInfo(cell.cellChildren, vcCellInfo);
    } else {
      vcCellInfo[cellType].isLeafCell = true;
    }
  }
};

const calculateQuota = (cellList, vcCellInfo) => {
  for (const cell of cellList) {
    const cellType = cell.cellType;
    vcCellInfo[cellType].quota += 1;
    if (cell.cellChildren) {
      calculateQuota(cell.cellChildren, vcCellInfo);
    }
  }
};

const calculateResource = (cellList, vcCellInfo) => {
  for (const cell of cellList) {
    const cellType = cell.cellType;
    // once resource is calculated, we can skip the following calculation for this type
    if (
      vcCellInfo[cellType].gpu > 0 ||
      vcCellInfo[cellType].cpu > 0 ||
      vcCellInfo[cellType].memory > 0
    ) {
      continue;
    }
    if (cell.cellChildren) {
      calculateResource(cell.cellChildren, vcCellInfo);
      const childCellType = cell.cellChildren[0].cellType;
      const childCellNumber = cell.cellChildren.length;
      vcCellInfo[cellType].gpu =
        vcCellInfo[childCellType].gpu * childCellNumber;
      vcCellInfo[cellType].cpu =
        vcCellInfo[childCellType].cpu * childCellNumber;
      vcCellInfo[cellType].memory =
        vcCellInfo[childCellType].memory * childCellNumber;
    } else {
      vcCellInfo[cellType].gpu = resourceUnits[cellType].gpu;
      vcCellInfo[cellType].cpu = resourceUnits[cellType].cpu;
      vcCellInfo[cellType].memory = resourceUnits[cellType].memory;
    }
  }
};

const getVcCellInfo = async (virtualCluster) => {
  // Return vcCellInfo. It is a map:
  //  key: cell type at all levels in this vc
  //  value: { isLeafCell: bool, quota: <maximum number at this level>, gpu: number; cpu: number; memory: number }
  let vcStatus;
  try {
    vcStatus = (
      await axios.get(
        `${hivedWebserviceUri}/v1/inspect/clusterstatus/virtualclusters/${virtualCluster}`,
      )
    ).data;
  } catch (error) {
    throw createError(
      'Internal Server Error',
      'CannotReachHiveDScheduler',
      error.response ? error.response.data : error,
    );
  }

  // use resourceUnits to filter unknown leaf cell type
  vcStatus = vcStatus.filter((cell) => cell.leafCellType in resourceUnits);
  const vcCellInfo = {};
  initVcCellInfo(vcStatus, vcCellInfo);
  calculateQuota(vcStatus, vcCellInfo);
  calculateResource(vcStatus, vcCellInfo);
  return vcCellInfo;
};

// if sku num is set, we use the sku num directly
// if sku num is not set, we calculate it from taskRoles.resourcePerInstance.{gpu, cpu, memeory}
// before this function is called, skuNum and skuType could be null
// after this function is called, skuNum can't be null, skuType could also be null
const calculateSkuNum = (protocolObj, opportunistic, vcCellInfo) => {
  const hivedConfig = _.get(protocolObj, 'extras.hivedScheduler');
  for (const taskRole of _.keys(protocolObj.taskRoles)) {
    const taskroleResourceSpec =
      hivedConfig.taskRoles[taskRole].resourcePerInstance;
    if (taskroleResourceSpec.skuNum === null) {
      // resource per cell is the resource provided by cluster
      // if skuType is not null, it is the corresponding skuType's resource
      // if skuType is null and opportunistic is false, it is the minimum resource unit in the VC:
      // if skuType is null and opportunistic is false, it is the minimum resource unit the cluster:
      const resourcePerCell = {};
      for (const t of ['gpu', 'cpu', 'memory']) {
        if (taskroleResourceSpec.skuType !== null) {
          // notice: taskroleResourceSpec.skuType can be non-leaf cell level sku type
          resourcePerCell[t] = vcCellInfo[taskroleResourceSpec.skuType][t];
        } else {
          if (opportunistic) {
            resourcePerCell[t] = _.min(
              _.values(resourceUnits).map((unit) => _.get(unit, t)),
            );
          } else {
            resourcePerCell[t] = _.min(
              _.values(vcCellInfo)
                .filter((cellInfo) => cellInfo.isLeafCell)
                .map((cellInfo) => _.get(cellInfo, t)),
            );
          }
        }
      }
      // handle empty resource
      const { gpu = 0, cpu, memoryMB } = protocolObj.taskRoles[
        taskRole
      ].resourcePerInstance;
      let requestedResource = '';
      let emptyResource = '';
      if (resourcePerCell.gpu === 0 && gpu > 0) {
        requestedResource = gpu;
        emptyResource = 'GPU';
      } else if (resourcePerCell.cpu === 0 && cpu > 0) {
        requestedResource = cpu;
        emptyResource = 'CPU';
      } else if (resourcePerCell.memory === 0 && memoryMB > 0) {
        requestedResource = memoryMB;
        emptyResource = 'memory';
      }
      if (emptyResource !== '') {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Taskrole ${taskRole} requests ${requestedResource} ${emptyResource}, but SKU does not ` +
            `configure ${emptyResource}. Please contact admin if the taskrole needs ${emptyResource} resources.`,
        );
      }
      const skuNum = _.max([
        gpu === 0 ? 0 : _.ceil(gpu / resourcePerCell.gpu),
        cpu === 0 ? 0 : _.ceil(cpu / resourcePerCell.cpu),
        memoryMB === 0 ? 0 : _.ceil(memoryMB / resourcePerCell.memory),
      ]);
      taskroleResourceSpec.skuNum = skuNum;
    }
  }
};

const validateSkuType = (hivedConfig, opportunistic, vcCellInfo) => {
  // TODO:
  //  1. for opportunistic job, it can use all types of cells in the cluster.
  //  Currently we do not gather such information, leave the validation to future work.
  //  2. skuType here should only allow cell level which is lower than node.
  for (const taskRole of _.keys(hivedConfig.taskRoles)) {
    const skuType = hivedConfig.taskRoles[taskRole].resourcePerInstance.skuType;
    if (skuType === null) {
      continue;
    }
    if (!opportunistic && !(skuType in vcCellInfo)) {
      throw createError(
        'Bad Request',
        'InvalidProtocolError',
        `Taskrole ${taskRole} has unknown skuType ${skuType}`,
      );
    }
  }
};

const validateWithinOne = (hivedConfig, opportunistic, vcCellInfo) => {
  // TODO: for opportunistic job, it can use all types of cells in the cluster.
  // Currently we do not gather such information, leave the validation to future work.
  for (const taskRole of _.keys(hivedConfig.taskRoles)) {
    const withinOneCell = hivedConfig.taskRoles[taskRole].withinOne;
    if (withinOneCell === null) {
      continue;
    }
    if (!opportunistic && !(withinOneCell in vcCellInfo)) {
      throw createError(
        'Bad Request',
        'InvalidProtocolError',
        `Taskrole ${taskRole} has unknown withinOne cell type ${withinOneCell}`,
      );
    }
  }
  for (const taskRoleGroup of _.get(hivedConfig, 'taskRoleGroups', [])) {
    const withinOneCell = taskRoleGroup.withinOne;
    if (withinOneCell === null) {
      continue;
    }
    if (!opportunistic && !(withinOneCell in vcCellInfo)) {
      throw createError(
        'Bad Request',
        'InvalidProtocolError',
        `Taskrole group ${taskRoleGroup.taskRoles} has unknown withinOne cell type ${withinOneCell}`,
      );
    }
  }
};

const hivedValidate = async (protocolObj, username) => {
  const [isSchemaOK, schemaError] = schemaValidate(protocolObj);
  if (!isSchemaOK) {
    throw createError('Bad Request', 'InvalidProtocolError', schemaError);
  }

  const hivedConfig = _.get(protocolObj, 'extras.hivedScheduler');
  const opportunistic = !!(_.get(hivedConfig, 'jobPriorityClass') === 'oppo');
  const gangAllocation = !!(
    _.get(protocolObj, 'extras.gangAllocation', true) === true
  );
  const virtualCluster = _.get(
    protocolObj,
    'defaults.virtualCluster',
    'default',
  );
  const vcCellInfo = await getVcCellInfo(virtualCluster);
  validateSkuType(hivedConfig, opportunistic, vcCellInfo);
  validateWithinOne(hivedConfig, opportunistic, vcCellInfo);
  calculateSkuNum(protocolObj, opportunistic, vcCellInfo);

  // Step 1: Initialize root groups
  const taskRole2GroupName = {};
  const rootPodGroups = {};
  // No matter whether gangAllocation is true or not, respect settings in taskRoleGroups first.
  for (const taskRoleGroup of _.get(hivedConfig, 'taskRoleGroups', [])) {
    const rootGroupName = `${username}~${
      protocolObj.name
    }/taskRoleGroups/${taskRoleGroup.taskRoles.join('_')}`;
    for (const taskRole of taskRoleGroup.taskRoles) {
      taskRole2GroupName[taskRole] = rootGroupName;
    }
    const withinOneCell = taskRoleGroup.withinOne;
    rootPodGroups[rootGroupName] = {
      name: rootGroupName,
      withinOneCell: withinOneCell,
      pods: null,
      childGroups: [],
    };
  }
  // For remaining task roles, if gangAllocation is true (or not set explicitly), put them in a default group.
  // If gangAllocation is false, no group will be generated for them.
  if (gangAllocation === true) {
    const defaultRootGroupName = `${username}~${protocolObj.name}/default`;
    for (const taskRole of _.keys(protocolObj.taskRoles)) {
      if (!(taskRole in taskRole2GroupName)) {
        taskRole2GroupName[taskRole] = defaultRootGroupName;
        // initialize default root group
        if (!(defaultRootGroupName in rootPodGroups)) {
          rootPodGroups[defaultRootGroupName] = {
            name: defaultRootGroupName,
            withinOneCell: null,
            pods: null,
            childGroups: [],
          };
        }
      }
    }
  }

  // Step 2: Fill in childGroups
  for (const taskRole in taskRole2GroupName) {
    const rootGroupName = taskRole2GroupName[taskRole];
    const group = rootPodGroups[rootGroupName];
    const taskRoleSetting = hivedConfig.taskRoles[taskRole];
    const cellType = taskRoleSetting.resourcePerInstance.skuType;
    const cellNumber = taskRoleSetting.resourcePerInstance.skuNum;
    const withinOneCell = taskRoleSetting.withinOne;
    const instanceNum = protocolObj.taskRoles[taskRole].instances;
    group.childGroups.push({
      name: `${rootGroupName}/${taskRole}`,
      withinOneCell: withinOneCell,
      pods: [
        {
          podMinNumber: instanceNum,
          podMaxNumber: instanceNum,
          cellsPerPod: {
            cellType: cellType,
            cellNumber: cellNumber,
          },
          // This field marks what taskrole generates this child group.
          // It will be replaced by containsCurrentPod later.
          generatedBy: taskRole,
        },
      ],
      childGroups: null,
    });
  }

  // Step 3: Validate quota (best effort)
  if (!opportunistic) {
    // cellTypeCount[<group name>][<cell type>] represents used cell number of <cell type> in <group name>
    const cellTypeCount = {};
    // cellTypeCount[<group name>] reprensts used cell number of null type in <group name>
    const anyTypeCount = {};
    for (const rootGroupName in rootPodGroups) {
      const group = rootPodGroups[rootGroupName];
      if (!(rootGroupName in cellTypeCount)) {
        cellTypeCount[rootGroupName] = {};
      }
      if (!(rootGroupName in anyTypeCount)) {
        anyTypeCount[rootGroupName] = 0;
      }
      for (const childGroup of group.childGroups) {
        for (const pod of childGroup.pods) {
          if (pod.cellsPerPod.cellType === null) {
            anyTypeCount[rootGroupName] +=
              pod.podMinNumber * pod.cellsPerPod.cellNumber;
          } else {
            if (!(pod.cellsPerPod.cellType in cellTypeCount[rootGroupName])) {
              cellTypeCount[rootGroupName][pod.cellsPerPod.cellType] = 0;
            }
            cellTypeCount[rootGroupName][pod.cellsPerPod.cellType] +=
              pod.podMinNumber * pod.cellsPerPod.cellNumber;
          }
        }
      }
    }
    // For non-null cell type: Used number should less than quota
    for (const cellType in vcCellInfo) {
      for (const rootGroupName in cellTypeCount) {
        if (cellType in cellTypeCount[rootGroupName]) {
          const requestCellCount = cellTypeCount[rootGroupName][cellType];
          const cellQuota = vcCellInfo[cellType].quota;
          if (requestCellCount > cellQuota) {
            throw createError(
              'Bad Request',
              'InvalidProtocolError',
              `Job requests ${requestCellCount} of cell type ${cellType} in one group, exceeds maximum ${cellQuota} in VC ${virtualCluster}.`,
            );
          }
        }
      }
    }
    // For null cell type:
    // number of (used number of null cell type + used number of non-null leaf cell type) should <= quota of all leaf cell types
    let vcLeafCellQuota = 0;
    for (const cellType in vcCellInfo) {
      if (vcCellInfo[cellType].isLeafCell) {
        vcLeafCellQuota += vcCellInfo[cellType].quota;
      }
    }
    for (const rootGroupName in anyTypeCount) {
      const groupAnyTypeCount = anyTypeCount[rootGroupName];
      let groupLeafTypeCount = 0;
      for (const cellType in cellTypeCount[rootGroupName]) {
        if (vcCellInfo[cellType].isLeafCell) {
          groupLeafTypeCount += cellTypeCount[rootGroupName][cellType];
        }
      }
      if (groupAnyTypeCount + groupLeafTypeCount > vcLeafCellQuota) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Job requests ${groupAnyTypeCount} cells of null cell type, and ${groupLeafTypeCount} cells with explicit leaf cell type in one group, exceeds maximum ${vcLeafCellQuota} leaf cell quota in VC ${virtualCluster}.`,
        );
      }
    }
  }

  // Step 4: Generate hived pod spec
  const priority = convertPriority(hivedConfig.jobPriorityClass);
  for (const taskRole in protocolObj.taskRoles) {
    const taskRoleSetting = hivedConfig.taskRoles[taskRole];
    const pinnedCellId = taskRoleSetting.pinnedCellId;
    const cellType = taskRoleSetting.resourcePerInstance.skuType;
    const cellNumber = taskRoleSetting.resourcePerInstance.skuNum;
    const podSpec = {
      version: 'v2',
      virtualCluster: virtualCluster,
      priority: priority,
      pinnedCellId: pinnedCellId,
      cellType: cellType,
      cellNumber: cellNumber,
      podRootGroup: null,
    };
    if (taskRole in taskRole2GroupName) {
      const rootGroupName = taskRole2GroupName[taskRole];
      const group = _.cloneDeep(rootPodGroups[rootGroupName]);
      // replace generatedBy with containsCurrentPod
      for (const childGroup of group.childGroups) {
        // For now, only 1 pod spec could exist in one child groups
        const podSpec = childGroup.pods[0];
        if (taskRole === podSpec.generatedBy) {
          podSpec.containsCurrentPod = true;
        } else {
          podSpec.containsCurrentPod = false;
        }
        delete podSpec.generatedBy;
      }
      // If the group only has one child group, we can put the child group into the top level
      if (group.childGroups.length === 1) {
        const childGroup = group.childGroups[0];
        group.withinOneCell = childGroup.withinOneCell;
        group.pods = _.cloneDeep(childGroup.pods);
        delete group.childGroups;
      }
      podSpec.podRootGroup = group;
    }
    protocolObj.taskRoles[taskRole].hivedPodSpec = podSpec;
  }
  return protocolObj;
};

const isV2Schema = (protocolObj) => {
  const taskRoles = _.get(protocolObj, 'extras.hivedScheduler.taskRoles', null);
  if (_.isObject(taskRoles)) {
    for (const taskrole in taskRoles) {
      if (
        _.has(taskRoles[taskrole], 'skuType') ||
        _.has(taskRoles[taskrole], 'skuNum')
      ) {
        return false;
      }
    }
  }
  return true;
};

module.exports = {
  validate: hivedValidate,
  isV2Schema: isV2Schema,
};
