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
const createError = require('@pai/utils/error');
const hivedSchema = require('@pai/config/v2/hived');
const {resourceUnits, virtualCellCapacity} = require('@pai/config/vc');

const cpuUnits = Object.values(resourceUnits).filter((v) => v.gpu === 0);
const gpuUnits = Object.values(resourceUnits).filter((v) => v.gpu > 0);

const convertPriority = (priorityClass='test') => {
  // TODO: make it a cluster-wise config
  // allowed range: [-1, 126], default priority 0
  const priorityMap = {
    crit: 120,
    prod: 100,
    test: 10,
    oppo: -1,
  };
  return priorityClass in priorityMap ? priorityMap[priorityClass] : null;
};

const hivedValidate = (protocolObj, username) => {
  if (!hivedSchema.validate(protocolObj)) {
    throw createError('Bad Request', 'InvalidProtocolError', hivedSchema.validate.errors);
  }
  let hivedConfig = null;
  const affinityGroups = {};
  const gangAllocation = ('extras' in protocolObj && protocolObj.extras.gangAllocation === false) ? false : true;
  const virtualCluster = ('defaults' in protocolObj && protocolObj.defaults.virtualCluster != null) ?
    protocolObj.defaults.virtualCluster : 'default';

  if ('extras' in protocolObj && 'hivedScheduler' in protocolObj.extras) {
    hivedConfig = protocolObj.extras.hivedScheduler;
    for (let taskRole of Object.keys(hivedConfig.taskRoles || {})) {
      // must be a valid taskRole
      if (!(taskRole in protocolObj.taskRoles)) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Hived error: ${taskRole} does not exist.`
        );
      }

      const taskRoleConfig = hivedConfig.taskRoles[taskRole];
      // at most one of [reservationId, gpuType] allowed
      if (taskRoleConfig.reservationId !== null && taskRoleConfig.gpuType !== null) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Hived error: ${taskRole} has both reservationId and gpuType, only one allowed.`
        );
      }

      if (taskRoleConfig.gpuType !== null && !(taskRoleConfig.gpuType in resourceUnits)) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Hived error: ${taskRole} has unknown gpuType ${taskRoleConfig.gpuType}, allow ${Object.keys(resourceUnits)}.`
        );
      }

      const affinityGroupName = taskRoleConfig.affinityGroupName;
      // affinityGroup should have uniform reservationId and gpuType
      if (affinityGroupName !== null) {
        if (affinityGroupName in affinityGroups) {
          if (taskRoleConfig.reservationId === null) {
            taskRoleConfig.reservationId = affinityGroups[affinityGroupName].reservationId;
          }
          if (taskRoleConfig.gpuType === null) {
            taskRoleConfig.gpuType = affinityGroups[affinityGroupName].gpuType;
          }
          if (taskRoleConfig.reservationId !== affinityGroups[affinityGroupName].reservationId ||
            taskRoleConfig.gpuType !== affinityGroups[affinityGroupName].gpuType) {
            throw createError(
              'Bad Request',
              'InvalidProtocolError',
              `Hived error: affinityGroup: ${affinityGroupName} has inconsistent gpuType or reservationId.`
            );
          }
        } else {
          affinityGroups[affinityGroupName] = {
            reservationId: taskRoleConfig.reservationId,
            gpuType: taskRoleConfig.gpuType,
            affinityTaskList: [],
          };
        }
        const {gpu = 0, cpu} = protocolObj.taskRoles[taskRole].resourcePerInstance;
        affinityGroups[affinityGroupName].affinityTaskList.push({
          podNumber: protocolObj.taskRoles[taskRole].instances,
          gpuNumber: gpu === 0 ? cpu : gpu,
        });
      }
    }

    for (let affinityGroupName of Object.keys(affinityGroups)) {
      if (affinityGroups[affinityGroupName].gpuType !== null &&
        affinityGroups[affinityGroupName].reservationId !== null) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Hived error: affinityGroup: ${affinityGroupName} has both reservationId and gpuType, only one allowed.`
        );
      }
    }
  }

  // generate default affinity group for the gang scheduling jobs
  let defaultAffinityGroup = null;
  if (!Object.keys(affinityGroups).length && gangAllocation) {
    defaultAffinityGroup = {
      affinityTaskList: Object.keys(protocolObj.taskRoles).map((taskRole) => {
        const {gpu = 0, cpu} = protocolObj.taskRoles[taskRole].resourcePerInstance;
        return {
          podNumber: protocolObj.taskRoles[taskRole].instances,
          gpuNumber: gpu === 0 ? cpu : gpu,
        };
      }),
    };
  }

  // generate podSpec for every taskRole
  let requestCellNumber = 0;
  for (let taskRole of Object.keys(protocolObj.taskRoles)) {
    const {gpu = 0, cpu, memoryMB} = protocolObj.taskRoles[taskRole].resourcePerInstance;
    const cellNumber = gpu === 0 ? cpu : gpu;
    requestCellNumber += protocolObj.taskRoles[taskRole].instances * cellNumber;

    let cpuPerCell, memoryMBPerCell;
    if (gpu === 0) {
      cpuPerCell = 1;
      memoryMBPerCell = Math.min(...Array.from(cpuUnits, (v) => v.memory));
    } else {
      cpuPerCell = Math.min(...Array.from(gpuUnits, (v) => v.cpu));
      memoryMBPerCell = Math.min(...Array.from(gpuUnits, (v) => v.memory));
    }

    const podSpec = {
      virtualCluster,
      priority: convertPriority(hivedConfig ? hivedConfig.jobPriorityClass : undefined),
      gpuType: null,
      reservationId: null,
      gpuNumber: cellNumber,
      affinityGroup: null,
    };
    if (hivedConfig && hivedConfig.taskRoles && taskRole in hivedConfig.taskRoles) {
      podSpec.gpuType = hivedConfig.taskRoles[taskRole].gpuType;
      if (podSpec.gpuType !== null) {
        cpuPerCell = resourceUnits[podSpec.gpuType].cpu;
        memoryMBPerCell = resourceUnits[podSpec.gpuType].memory;
      }
      podSpec.reservationId = hivedConfig.taskRoles[taskRole].reservationId;

      const affinityGroupName = hivedConfig.taskRoles[taskRole].affinityGroupName;
      podSpec.affinityGroup = affinityGroupName ? {
        name: `${username}~${protocolObj.name}/${affinityGroupName}`,
        members: affinityGroups[affinityGroupName].affinityTaskList,
      } : null;
    }

    if (defaultAffinityGroup != null) {
      podSpec.affinityGroup = {
        name: `${username}~${protocolObj.name}/default`,
        members: defaultAffinityGroup.affinityTaskList,
      };
    }

    if (gpu === 0) {
      if (cpuUnits.length === 0) {
        throw createError('Bad Request', 'InvalidProtocolError', 'Hived error: No CPU cell configured.');
      }
      if (memoryMB > memoryMBPerCell * cellNumber) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Hived error: ${taskRole} requests ${memoryMB}MB memory; allow ${memoryMBPerCell}MB memory per CPU.`
        );
      }
    } else {
      if (gpuUnits.length === 0) {
        throw createError('Bad Request', 'InvalidProtocolError', 'Hived error: No GPU cell configured.');
      }
      if (cpu > cpuPerCell * cellNumber || memoryMB > memoryMBPerCell * cellNumber) {
        throw createError(
          'Bad Request',
          'InvalidProtocolError',
          `Hived error: ${taskRole} requests ${cpu} CPU, ${memoryMB}MB memory; allow ${cpuPerCell} CPU, ${memoryMBPerCell}MB memory per GPU.`
        );
      }
    }

    protocolObj.taskRoles[taskRole].hivedPodSpec = podSpec;
  }
  const maxGpuNumber = Object.values(virtualCellCapacity[virtualCluster].quota).reduce((sum, resources) => sum + resources.gpu, 0);
  if (requestCellNumber > maxGpuNumber && gangAllocation && !(hivedConfig && hivedConfig.jobPriorityClass === 'oppo')) {
    throw createError('Bad Request', 'InvalidProtocolError', `Hived error: exceed ${maxGpuNumber} GPU quota in ${virtualCluster} VC.`);
  }
  return protocolObj;
};

module.exports = {
  validate: hivedValidate,
};
