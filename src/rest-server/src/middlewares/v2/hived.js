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
const { get, pickBy } = require('lodash');
const createError = require('@pai/utils/error');
const logger = require('@pai/config/logger');
const hivedSchema = require('@pai/config/v2/hived');
const hivedV2 = require('@pai/middlewares/v2/hived_v2');
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

const getCellStatus = async (virtualCluster) => {
  let vcStatus;
  try {
    vcStatus = (
      await axios.get(
        `${hivedWebserviceUri}/v1/inspect/clusterstatus/virtualclusters/${virtualCluster}`,
      )
    ).data;
  } catch (error) {
    logger.warn(
      'Failed to inspect vc from hived scheduler: ',
      error.response ? error.response.data : error,
    );
    return {
      cellQuota: Number.MAX_SAFE_INTEGER,
      cellUnits: { ...resourceUnits },
    };
  }

  let cellQuota = 0;
  const cellUnits = [...new Set(vcStatus.map((cell) => cell.leafCellType))]
    .filter((key) => key in resourceUnits)
    .reduce((dict, key) => ({ ...dict, [key]: resourceUnits[key] }), {});
  const cellQueue = [...vcStatus];
  while (cellQueue.length > 0) {
    const curr = cellQueue.shift();
    if (curr.cellPriority === -1) {
      continue;
    }
    if (curr.cellChildren) {
      cellQueue.push(...curr.cellChildren);
    } else {
      cellQuota += 1;
    }
  }
  return { cellQuota, cellUnits };
};

const hivedValidate = async (protocolObj, username) => {
  if (hivedV2.isV2Schema(protocolObj)) {
    return await hivedV2.validate(protocolObj, username);
  }
  if (!hivedSchema.validate(protocolObj)) {
    throw createError(
      'Bad Request',
      'InvalidProtocolError',
      hivedSchema.validate.errors,
    );
  }

  const hivedConfig = get(protocolObj, 'extras.hivedScheduler', null);
  const opportunistic = !!(get(hivedConfig, 'jobPriorityClass') === 'oppo');
  const gangAllocation = !!(
    get(protocolObj, 'extras.gangAllocation', true) === true
  );
  const virtualCluster = get(protocolObj, 'defaults.virtualCluster', 'default');

  const affinityGroups = {};
  const { cellQuota, cellUnits } = await getCellStatus(virtualCluster);

  // generate podSpec for every taskRole
  for (const taskRole of Object.keys(protocolObj.taskRoles)) {
    const podSpec = pickBy(
      {
        virtualCluster,
        priority: convertPriority(get(hivedConfig, 'jobPriorityClass')),
        pinnedCellId: get(
          hivedConfig,
          `taskRoles.${taskRole}.pinnedCellId`,
          null,
        ),
        leafCellType: get(hivedConfig, `taskRoles.${taskRole}.skuType`, null),
        leafCellNumber: get(hivedConfig, `taskRoles.${taskRole}.skuNumber`, 0),
        gangReleaseEnable: get(hivedConfig, 'gangReleaseEnable'),
        lazyPreemptionEnable: get(hivedConfig, 'lazyPreemptionEnable'),
        ignoreK8sSuggestedNodes: get(hivedConfig, 'ignoreK8sSuggestedNodes'),
        affinityGroup: null,
      },
      (v) => v !== undefined,
    );

    // calculate sku number
    const resourcePerCell = {};
    for (const t of ['gpu', 'cpu', 'memory']) {
      if (podSpec.leafCellType != null) {
        resourcePerCell[t] = resourceUnits[podSpec.leafCellType][t];
      } else {
        resourcePerCell[t] = Math.min(
          ...Array.from(
            Object.values(opportunistic ? resourceUnits : cellUnits),
            (v) => v[t],
          ),
        );
      }
    }
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
    podSpec.leafCellNumber = Math.max(
      gpu === 0 ? 0 : Math.ceil(gpu / resourcePerCell.gpu),
      cpu === 0 ? 0 : Math.ceil(cpu / resourcePerCell.cpu),
      memoryMB === 0 ? 0 : Math.ceil(memoryMB / resourcePerCell.memory),
    );

    protocolObj.taskRoles[taskRole].hivedPodSpec = podSpec;
  }

  if (hivedConfig != null) {
    for (const taskRole of Object.keys(hivedConfig.taskRoles || {})) {
      // must be a valid taskRole
      if (!(taskRole in protocolObj.taskRoles)) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Taskrole ${taskRole} does not exist.`,
        );
      }

      const skuType = protocolObj.taskRoles[taskRole].hivedPodSpec.leafCellType;
      const pinnedCellId =
        protocolObj.taskRoles[taskRole].hivedPodSpec.pinnedCellId;
      // only allow one of {skuType, pinnedCellId}
      if (skuType != null && pinnedCellId != null) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Taskrole ${taskRole} has both skuType and pinnedCellId, only one is allowed.`,
        );
      }
      // check whether skuType is valid
      if (skuType != null) {
        if (!(skuType in resourceUnits)) {
          throw createError(
            'Bad Request',
            'InvalidProtocolError',
            `Taskrole ${taskRole} has unknown skuType ${skuType}, allow ${Object.keys(
              resourceUnits,
            )}.`,
          );
        }
        if (!opportunistic && !(skuType in cellUnits)) {
          throw createError(
            'Bad Request',
            'InvalidProtocolError',
            `Taskrole ${taskRole} has skuType ${skuType}, VC ${virtualCluster} only allows ${Object.keys(
              cellUnits,
            )}.`,
          );
        }
      }

      const affinityGroupName =
        hivedConfig.taskRoles[taskRole].affinityGroupName;
      // affinityGroup should have united skuType or pinnedCellId
      if (affinityGroupName != null) {
        if (affinityGroupName in affinityGroups) {
          if (
            skuType !== affinityGroups[affinityGroupName].skuType ||
            pinnedCellId !== affinityGroups[affinityGroupName].pinnedCellId
          ) {
            throw createError(
              'Bad Request',
              'InvalidProtocolError',
              `AffinityGroup ${affinityGroupName} has inconsistent skuType or pinnedCellId.`,
            );
          }
        } else {
          affinityGroups[affinityGroupName] = {
            skuType,
            pinnedCellId,
            affinityTaskList: [],
          };
        }
        affinityGroups[affinityGroupName].affinityTaskList.push({
          podNumber: protocolObj.taskRoles[taskRole].instances,
          leafCellNumber:
            protocolObj.taskRoles[taskRole].hivedPodSpec.leafCellNumber,
        });
      }
    }
  }

  // generate default affinity group for the gang scheduling jobs
  let defaultAffinityGroup = null;
  if (!Object.keys(affinityGroups).length && gangAllocation) {
    defaultAffinityGroup = {
      affinityTaskList: Object.keys(protocolObj.taskRoles).map((taskRole) => {
        return {
          podNumber: protocolObj.taskRoles[taskRole].instances,
          leafCellNumber:
            protocolObj.taskRoles[taskRole].hivedPodSpec.leafCellNumber,
        };
      }),
    };
  }

  let requestCellNumber = 0;
  for (const taskRole of Object.keys(protocolObj.taskRoles)) {
    const affinityGroupName = get(
      hivedConfig,
      `taskRoles.${taskRole}.affinityGroupName`,
    );
    if (affinityGroupName != null) {
      protocolObj.taskRoles[taskRole].hivedPodSpec.affinityGroup = {
        name: `${username}~${protocolObj.name}/${affinityGroupName}`,
        members: affinityGroups[affinityGroupName].affinityTaskList,
      };
    }
    if (defaultAffinityGroup != null) {
      protocolObj.taskRoles[taskRole].hivedPodSpec.affinityGroup = {
        name: `${username}~${protocolObj.name}/default`,
        members: defaultAffinityGroup.affinityTaskList,
      };
    }
    requestCellNumber +=
      protocolObj.taskRoles[taskRole].instances *
      protocolObj.taskRoles[taskRole].hivedPodSpec.leafCellNumber;
  }
  // best effort check cell quota
  if (requestCellNumber > cellQuota && gangAllocation && !opportunistic) {
    throw createError(
      'Bad Request',
      'InvalidProtocolError',
      `Job requests ${requestCellNumber} SKUs, exceeds maximum ${cellQuota} SKUs in VC ${virtualCluster}.`,
    );
  }

  return protocolObj;
};

module.exports = {
  validate: hivedValidate,
};
