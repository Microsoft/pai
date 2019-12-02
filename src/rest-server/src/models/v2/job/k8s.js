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
const {Agent} = require('https');
const zlib = require('zlib');
const axios = require('axios');
const yaml = require('js-yaml');
const base32 = require('base32');
const status = require('statuses');
const querystring = require('querystring');
const runtimeEnv = require('./runtime-env');
const launcherConfig = require('@pai/config/launcher');
const {apiserver} = require('@pai/config/kubernetes');
const createError = require('@pai/utils/error');
const protocolSecret = require('@pai/utils/protocolSecret');
const userModel = require('@pai/models/v2/user');
const env = require('@pai/utils/env');
const k8s = require('@pai/utils/k8sUtils');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const logger = require('@pai/config/logger');
const restServerConfig = require('@pai/config');

let exitSpecPath;
if (process.env[env.exitSpecPath]) {
  exitSpecPath = process.env[env.exitSpecPath];
  if (!path.isAbsolute(exitSpecPath)) {
    exitSpecPath = path.resolve(__dirname, '../../../../', exitSpecPath);
  }
} else {
  exitSpecPath = '/k8s-job-exit-spec-configuration/k8s-job-exit-spec.yaml';
}
const exitSpecList = yaml.safeLoad(fs.readFileSync(exitSpecPath));
const positiveFallbackExitCode = 256;
const negativeFallbackExitCode = -8000;
const exitSpecMap = {};
exitSpecList.forEach((val) => {
  exitSpecMap[val.code] = val;
});

const convertName = (name) => {
  // convert framework name to fit framework controller spec
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const encodeName = (name) => {
  if (name.startsWith('unknown') || !name.includes('~')) {
    // framework is not generated by PAI
    return convertName(name.replace(/^unknown/g, ''));
  } else {
    // base32 encode
    return base32.encode(name);
  }
};

const decodeName = (name, labels) => {
  if (labels && labels.jobName) {
    return labels.jobName;
  } else {
    // framework name has not been encoded
    return name;
  }
};

const decompressField = (val) => {
  if (val == null) {
    return null;
  } else {
    return JSON.parse(zlib.gunzipSync(Buffer.from(val, 'base64')).toString());
  }
};

const convertState = (state, exitCode, retryDelaySec) => {
  switch (state) {
    case 'AttemptCreationPending':
    case 'AttemptCreationRequested':
    case 'AttemptPreparing':
      return 'WAITING';
    case 'AttemptRunning':
      return 'RUNNING';
    case 'AttemptDeletionPending':
    case 'AttemptDeletionRequested':
    case 'AttemptDeleting':
      if (exitCode === -210 || exitCode === -220) {
        return 'STOPPING';
      } else {
        return 'RUNNING';
      }
    case 'AttemptCompleted':
      if (retryDelaySec == null) {
        return 'RUNNING';
      } else {
        return 'WAITING';
      }
    case 'Completed':
      if (exitCode === 0) {
        return 'SUCCEEDED';
      } else if (exitCode === -210 || exitCode === -220) {
        return 'STOPPED';
      } else {
        return 'FAILED';
      }
    default:
      return 'UNKNOWN';
  }
};

const mockFrameworkStatus = () => {
  return {
    state: 'AttemptCreationPending',
    attemptStatus: {
      completionStatus: null,
      taskRoleStatuses: [],
    },
    retryPolicyStatus: {
      retryDelaySec: null,
      totalRetriedCount: 0,
      accountableRetriedCount: 0,
    },
  };
};

const convertFrameworkSummary = (framework) => {
  if (!framework.status) {
    framework.status = mockFrameworkStatus();
  }
  const completionStatus = framework.status.attemptStatus.completionStatus;
  return {
    name: decodeName(framework.metadata.name, framework.metadata.labels),
    frameworkName: framework.metadata.name,
    username: framework.metadata.labels ? framework.metadata.labels.userName : 'unknown',
    state: convertState(
      framework.status.state,
      completionStatus ? completionStatus.code : null,
      framework.status.retryPolicyStatus.retryDelaySec,
    ),
    subState: framework.status.state,
    executionType: framework.spec.executionType.toUpperCase(),
    retries: framework.status.retryPolicyStatus.totalRetriedCount,
    retryDetails: {
      user: framework.status.retryPolicyStatus.accountableRetriedCount,
      platform: framework.status.retryPolicyStatus.totalRetriedCount - framework.status.retryPolicyStatus.accountableRetriedCount,
      resource: 0,
    },
    retryDelayTime: framework.status.retryPolicyStatus.retryDelaySec,
    createdTime: new Date(framework.metadata.creationTimestamp).getTime(),
    completedTime: new Date(framework.status.completionTime).getTime(),
    appExitCode: completionStatus ? completionStatus.code : null,
    virtualCluster: framework.metadata.labels ? framework.metadata.labels.virtualCluster : 'unknown',
    totalGpuNumber: framework.metadata.annotations ? framework.metadata.annotations.totalGpuNumber : 0,
    totalTaskNumber: framework.spec.taskRoles.reduce(
      (num, spec) => num + spec.taskNumber, 0),
    totalTaskRoleNumber: framework.spec.taskRoles.length,
  };
};

const convertTaskDetail = async (taskStatus, ports, userName, jobName, taskRoleName) => {
  // get container ports
  const containerPorts = {};
  if (ports) {
    const randomPorts = JSON.parse(ports);
    for (let port of Object.keys(randomPorts)) {
      containerPorts[port] = randomPorts[port].start + taskStatus.index * randomPorts[port].count;
    }
  }
  // get container gpus
  let containerGpus = null;
  try {
    const pod = (await axios({
      method: 'get',
      url: launcherConfig.podPath(taskStatus.attemptStatus.podName),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
    })).data;
    if (launcherConfig.enabledHived) {
      const isolation = pod.metadata.annotations['hivedscheduler.microsoft.com/pod-gpu-isolation'];
      containerGpus = isolation.split(',').reduce((attr, id) => attr + Math.pow(2, id), 0);
    } else {
      const gpuNumber = k8s.atoi(pod.spec.containers[0].resources.limits['nvidia.com/gpu']);
      // mock GPU ids from 0 to (gpuNumber - 1)
      containerGpus = Math.pow(2, gpuNumber) - 1;
    }
  } catch (err) {
    containerGpus = null;
  }
  const completionStatus = taskStatus.attemptStatus.completionStatus;
  return {
    taskIndex: taskStatus.index,
    taskState: convertState(
      taskStatus.state,
      completionStatus ? completionStatus.code : null,
      taskStatus.retryPolicyStatus.retryDelaySec,
    ),
    containerId: taskStatus.attemptStatus.podUID,
    containerIp: taskStatus.attemptStatus.podHostIP,
    containerPorts,
    containerGpus,
    containerLog: `http://${taskStatus.attemptStatus.podHostIP}:${process.env.LOG_MANAGER_PORT}/log-manager/tail/${userName}/${jobName}/${taskRoleName}/${taskStatus.attemptStatus.podUID}/`,
    containerExitCode: completionStatus ? completionStatus.code : null,
  };
};

const convertFrameworkDetail = async (framework) => {
  if (!framework.status) {
    framework.status = mockFrameworkStatus();
  }
  // check fields which may be compressed
  if (framework.status.attemptStatus.taskRoleStatuses == null) {
    framework.status.attemptStatus.taskRoleStatuses = decompressField(framework.status.attemptStatus.taskRoleStatusesCompressed);
  }

  const completionStatus = framework.status.attemptStatus.completionStatus;
  const diagnostics = completionStatus ? completionStatus.diagnostics : null;
  const exitDiagnostics = generateExitDiagnostics(diagnostics);
  const detail = {
    name: decodeName(framework.metadata.name, framework.metadata.labels),
    frameworkName: framework.metadata.name,
    jobStatus: {
      username: framework.metadata.labels ? framework.metadata.labels.userName : 'unknown',
      state: convertState(
        framework.status.state,
        completionStatus ? completionStatus.code : null,
        framework.status.retryPolicyStatus.retryDelaySec,
      ),
      subState: framework.status.state,
      executionType: framework.spec.executionType.toUpperCase(),
      retries: framework.status.retryPolicyStatus.totalRetriedCount,
      retryDetails: {
        user: framework.status.retryPolicyStatus.accountableRetriedCount,
        platform: framework.status.retryPolicyStatus.totalRetriedCount - framework.status.retryPolicyStatus.accountableRetriedCount,
        resource: 0,
      },
      retryDelayTime: framework.status.retryPolicyStatus.retryDelaySec,
      createdTime: new Date(framework.metadata.creationTimestamp).getTime(),
      completedTime: new Date(framework.status.completionTime).getTime(),
      appId: framework.status.attemptStatus.instanceUID,
      appProgress: completionStatus ? 1 : 0,
      appTrackingUrl: '',
      appLaunchedTime: new Date(framework.metadata.creationTimestamp).getTime(),
      appCompletedTime: new Date(framework.status.completionTime).getTime(),
      appExitCode: completionStatus ? completionStatus.code : null,
      appExitSpec: completionStatus ? generateExitSpec(completionStatus.code) : generateExitSpec(null),
      appExitDiagnostics: exitDiagnostics ? exitDiagnostics.diagnosticsSummary : null,
      appExitMessages: exitDiagnostics ? {
        container: null,
        runtime: exitDiagnostics.runtime,
        launcher: exitDiagnostics.launcher,
      } : null,
      appExitTriggerMessage: completionStatus && completionStatus.trigger ? completionStatus.trigger.message : null,
      appExitTriggerTaskRoleName: completionStatus && completionStatus.trigger ? completionStatus.trigger.taskRoleName : null,
      appExitTriggerTaskIndex: completionStatus && completionStatus.trigger ? completionStatus.trigger.taskIndex : null,
      appExitType: completionStatus ? completionStatus.type.name : null,
      virtualCluster: framework.metadata.labels ? framework.metadata.labels.virtualCluster : 'unknown',
    },
    taskRoles: {},
  };
  const ports = {};
  for (let taskRoleSpec of framework.spec.taskRoles) {
    ports[taskRoleSpec.name] = taskRoleSpec.task.pod.metadata.annotations['rest-server/port-scheduling-spec'];
  }

  const userName = framework.metadata.labels ? framework.metadata.labels.userName : 'unknown';
  const jobName = decodeName(framework.metadata.name, framework.metadata.labels);

  for (let taskRoleStatus of framework.status.attemptStatus.taskRoleStatuses) {
    detail.taskRoles[taskRoleStatus.name] = {
      taskRoleStatus: {
        name: taskRoleStatus.name,
      },
      taskStatuses: await Promise.all(taskRoleStatus.taskStatuses.map(
        async (status) => await convertTaskDetail(status, ports[taskRoleStatus.name], userName, jobName, taskRoleStatus.name))
      ),
    };
  }
  return detail;
};

const generateTaskRole = (frameworkName, taskRole, labels, config, userToken) => {
  const ports = config.taskRoles[taskRole].resourcePerInstance.ports || {};
  for (let port of ['ssh', 'http']) {
    if (!(port in ports)) {
      ports[port] = 1;
    }
  }
  // schedule ports in [20000, 40000) randomly
  const randomPorts = {};
  for (let port of Object.keys(ports)) {
    randomPorts[port] = {
      start: Math.floor((Math.random() * 20000) + 20000),
      count: ports[port],
    };
  }
  // get shared memory size
  let shmMB = 512;
  if ('extraContainerOptions' in config.taskRoles[taskRole]) {
    shmMB = config.taskRoles[taskRole].extraContainerOptions.shmMB || 512;
  }
  // check InfiniBand device
  const infinibandDevice = Boolean('extraContainerOptions' in config.taskRoles[taskRole] &&
    config.taskRoles[taskRole].extraContainerOptions.infiniband);
  // enable gang scheduling or not
  let gangAllocation = 'true';
  const retryPolicy = {
    fancyRetryPolicy: false,
    maxRetryCount: 0,
  };
  if ('extras' in config && config.extras.gangAllocation === false) {
    gangAllocation = 'false';
    retryPolicy.fancyRetryPolicy = true;
    retryPolicy.maxRetryCount = config.taskRoles[taskRole].taskRetryCount || 0;
  }

  const frameworkTaskRole = {
    name: convertName(taskRole),
    taskNumber: config.taskRoles[taskRole].instances || 1,
    task: {
      retryPolicy,
      podGracefulDeletionTimeoutSec: launcherConfig.podGracefulDeletionTimeoutSec,
      pod: {
        metadata: {
          labels: {
            ...labels,
            type: 'kube-launcher-task',
          },
          annotations: {
            'container.apparmor.security.beta.kubernetes.io/app': 'unconfined',
            'rest-server/port-scheduling-spec': JSON.stringify(randomPorts),
          },
        },
        spec: {
          privileged: false,
          restartPolicy: 'Never',
          serviceAccountName: 'frameworkbarrier-account',
          initContainers: [
            {
              name: 'init',
              imagePullPolicy: 'Always',
              image: launcherConfig.runtimeImage,
              env: [
                {
                  name: 'USER_CMD',
                  value: config.taskRoles[taskRole].entrypoint,
                },
                {
                  name: 'KUBE_APISERVER_ADDRESS',
                  value: launcherConfig.apiServerUri,
                },
                {
                  name: 'GANG_ALLOCATION',
                  value: gangAllocation,
                },
                // Pass user token to runtime to give runtime permission to call rest server
                // Actually we should provide service token for kube-runtime and do not let
                // runtime personate as a real user.
                {
                  name: 'PAI_USER_TOKEN',
                  value: userToken,
                },
                {
                  name: 'PAI_USER_NAME',
                  value: labels.userName,
                },
                {
                  name: 'PAI_JOB_NAME',
                  value: `${labels.userName}~${labels.jobName}`,
                },
                {
                  name: 'PAI_REST_SERVER_URI',
                  value: restServerConfig.restServerUri,
                },
              ],
              volumeMounts: [
                {
                  name: 'pai-vol',
                  mountPath: '/usr/local/pai',
                },
                {
                  name: 'host-log',
                  subPath: `${labels.userName}/${labels.jobName}/${convertName(taskRole)}`,
                  mountPath: '/usr/local/pai/logs',
                },
                {
                  name: 'job-exit-spec',
                  mountPath: '/usr/local/pai-config',
                },
              ],
            },
          ],
          containers: [
            {
              name: 'app',
              imagePullPolicy: 'Always',
              image: config.prerequisites.dockerimage[config.taskRoles[taskRole].dockerImage].uri,
              command: ['/usr/local/pai/runtime'],
              resources: {
                limits: {
                  'cpu': config.taskRoles[taskRole].resourcePerInstance.cpu,
                  'memory': `${config.taskRoles[taskRole].resourcePerInstance.memoryMB}Mi`,
                  'github.com/fuse': 1,
                  'nvidia.com/gpu': config.taskRoles[taskRole].resourcePerInstance.gpu,
                  ...infinibandDevice && {'rdma/hca': 1},
                },
              },
              env: [],
              securityContext: {
                capabilities: {
                  add: ['SYS_ADMIN', 'IPC_LOCK', 'DAC_READ_SEARCH'],
                  drop: ['MKNOD'],
                },
              },
              terminationMessagePath: '/tmp/pai-termination-log',
              volumeMounts: [
                {
                  name: 'dshm',
                  mountPath: '/dev/shm',
                },
                {
                  name: 'pai-vol',
                  mountPath: '/usr/local/pai',
                },
                {
                  name: 'host-log',
                  subPath: `${labels.userName}/${labels.jobName}/${convertName(taskRole)}`,
                  mountPath: '/usr/local/pai/logs',
                },
                {
                  name: 'job-ssh-secret-volume',
                  readOnly: true,
                  mountPath: '/usr/local/pai/ssh-secret',
                },
              ],
            },
          ],
          volumes: [
            {
              name: 'dshm',
              emptyDir: {
                medium: 'Memory',
                sizeLimit: `${shmMB}Mi`,
              },
            },
            {
              name: 'pai-vol',
              emptyDir: {},
            },
            {
              name: 'host-log',
              hostPath: {
                path: `/var/log/pai`,
              },
            },
            {
              name: 'job-ssh-secret-volume',
              secret: {
                secretName: 'job-ssh-secret',
              },
            },
            {
              name: 'job-exit-spec',
              configMap: {
                name: 'runtime-exit-spec-configuration',
              },
            },
          ],
          affinity: {
            nodeAffinity: {
              requiredDuringSchedulingIgnoredDuringExecution: {
                nodeSelectorTerms: [
                  {
                    matchExpressions: [
                      {
                        key: 'pai-worker',
                        operator: 'In',
                        values: ['true'],
                      },
                    ],
                  },
                ],
              },
            },
          },
          imagePullSecrets: [
            {
              name: launcherConfig.runtimeImagePullSecrets,
            },
          ],
          hostNetwork: true,
        },
      },
    },
  };
  // add image pull secret
  if (config.prerequisites.dockerimage[config.taskRoles[taskRole].dockerImage].auth) {
    frameworkTaskRole.task.pod.spec.imagePullSecrets.push({
      name: `${encodeName(frameworkName)}-regcred`,
    });
  }
  // fill in completion policy
  const completion = config.taskRoles[taskRole].completion;
  frameworkTaskRole.frameworkAttemptCompletionPolicy = {
    minFailedTaskCount:
      (completion && 'minFailedInstances' in completion && completion.minFailedInstances) ?
      completion.minFailedInstances : 1,
    minSucceededTaskCount:
      (completion && 'minSucceededInstances' in completion && completion.minSucceededInstances) ?
      completion.minSucceededInstances : -1,
  };
  // hived spec
  if (launcherConfig.enabledHived) {
    frameworkTaskRole.task.pod.spec.schedulerName = launcherConfig.scheduler;

    delete frameworkTaskRole.task.pod.spec.containers[0].resources.limits['nvidia.com/gpu'];
    frameworkTaskRole.task.pod.spec.containers[0]
      .resources.limits['hivedscheduler.microsoft.com/pod-scheduling-enable'] = 1;
    frameworkTaskRole.task.pod.metadata.annotations['hivedscheduler.microsoft.com/pod-scheduling-spec'] = yaml.safeDump(config.taskRoles[taskRole].hivedPodSpec);
    frameworkTaskRole.task.pod.spec.containers[0].env.push(
      {
        name: 'NVIDIA_VISIBLE_DEVICES',
        valueFrom: {
          fieldRef: {
            fieldPath: `metadata.annotations['hivedscheduler.microsoft.com/pod-gpu-isolation']`,
          },
        },
      });
  }

  return frameworkTaskRole;
};

const generateFrameworkDescription = (frameworkName, virtualCluster, config, rawConfig, userToken) => {
  const [userName, jobName] = frameworkName.split(/~(.+)/);
  const frameworkLabels = {
    jobName,
    userName,
    virtualCluster,
  };
  const frameworkDescription = {
    apiVersion: launcherConfig.apiVersion,
    kind: 'Framework',
    metadata: {
      name: encodeName(frameworkName),
      labels: frameworkLabels,
      annotations: {
        config: protocolSecret.mask(rawConfig),
      },
    },
    spec: {
      executionType: 'Start',
      retryPolicy: {
        fancyRetryPolicy: (config.jobRetryCount !== -2),
        maxRetryCount: config.jobRetryCount || 0,
      },
      taskRoles: [],
    },
  };
  // generate runtime env
  const env = runtimeEnv.generateFrameworkEnv(frameworkName, config);
  const envlist = Object.keys(env).map((name) => {
    return {name, value: `${env[name]}`};
  });
  // fill in task roles
  let totalGpuNumber = 0;
  for (let taskRole of Object.keys(config.taskRoles)) {
    totalGpuNumber += config.taskRoles[taskRole].resourcePerInstance.gpu * config.taskRoles[taskRole].instances;
    const taskRoleDescription = generateTaskRole(frameworkName, taskRole, frameworkLabels, config, userToken);
    taskRoleDescription.task.pod.spec.priorityClassName = `${encodeName(frameworkName)}-priority`;
    taskRoleDescription.task.pod.spec.containers[0].env.push(...envlist.concat([
      {
        name: 'PAI_CURRENT_TASK_ROLE_NAME',
        valueFrom: {
          fieldRef: {
            fieldPath: `metadata.annotations['FC_TASKROLE_NAME']`,
          },
        },
      },
      {
        name: 'PAI_CURRENT_TASK_ROLE_CURRENT_TASK_INDEX',
        valueFrom: {
          fieldRef: {
            fieldPath: `metadata.annotations['FC_TASK_INDEX']`,
          },
        },
      },
      // backward compatibility
      {
        name: 'PAI_TASK_INDEX',
        valueFrom: {
          fieldRef: {
            fieldPath: `metadata.annotations['FC_TASK_INDEX']`,
          },
        },
      },
    ]));
    frameworkDescription.spec.taskRoles.push(taskRoleDescription);
  }
  frameworkDescription.metadata.annotations.totalGpuNumber = `${totalGpuNumber}`;
  return frameworkDescription;
};

const createPriorityClass = async (frameworkName, priority) => {
  const priorityClass = {
    apiVersion: 'scheduling.k8s.io/v1',
    kind: 'PriorityClass',
    metadata: {
      name: `${encodeName(frameworkName)}-priority`,
    },
    value: priority,
    preemptionPolicy: 'PreemptLowerPriority',
    globalDefault: false,
  };

  let response;
  try {
    response = await axios({
      method: 'post',
      url: launcherConfig.priorityClassesPath(),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
      data: priorityClass,
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      throw error;
    }
  }
  if (response.status !== status('Created')) {
    throw createError(response.status, 'UnknownError', response.data.message);
  }
};

const patchPriorityClassOwner = async (frameworkName, frameworkUid) => {
  try {
    const headers = {...launcherConfig.requestHeaders};
    headers['Content-Type'] = 'application/merge-patch+json';
    await axios({
      method: 'patch',
      url: launcherConfig.priorityClassPath(`${encodeName(frameworkName)}-priority`),
      headers,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
      data: {
        metadata: {
          ownerReferences: [{
            apiVersion: launcherConfig.apiVersion,
            kind: 'Framework',
            name: encodeName(frameworkName),
            uid: frameworkUid,
            controller: false,
            blockOwnerDeletion: false,
          }],
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to patch owner reference for priority class', error);
  }
};

const deletePriorityClass = async (frameworkName) => {
  try {
    await axios({
      method: 'delete',
      url: launcherConfig.priorityClassPath(`${encodeName(frameworkName)}-priority`),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
    });
  } catch (error) {
    logger.warn('Failed to delete priority class', error);
  }
};

const createSecret = async (frameworkName, auths) => {
  const cred = {
    auths: {},
  };
  for (let auth of auths) {
    const {
      username = '',
      password = '',
      registryuri = 'https://index.docker.io/v1/',
    } = auth;
    cred.auths[registryuri] = {
      auth: Buffer.from(`${username}:${password}`).toString('base64'),
    };
  }
  const secret = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: `${encodeName(frameworkName)}-regcred`,
      namespace: 'default',
    },
    data: {
      '.dockerconfigjson': Buffer.from(JSON.stringify(cred)).toString('base64'),
    },
    type: 'kubernetes.io/dockerconfigjson',
  };

  let response;
  try {
    response = await axios({
      method: 'post',
      url: launcherConfig.secretsPath(),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
      data: secret,
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      throw error;
    }
  }
  if (response.status !== status('Created')) {
    throw createError(response.status, 'UnknownError', response.data.message);
  }
};

const patchSecretOwner = async (frameworkName, frameworkUid) => {
  try {
    const headers = {...launcherConfig.requestHeaders};
    headers['Content-Type'] = 'application/merge-patch+json';
    await axios({
      method: 'patch',
      url: launcherConfig.secretPath(`${encodeName(frameworkName)}-regcred`),
      headers,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
      data: {
        metadata: {
          ownerReferences: [{
            apiVersion: launcherConfig.apiVersion,
            kind: 'Framework',
            name: encodeName(frameworkName),
            uid: frameworkUid,
            controller: true,
            blockOwnerDeletion: true,
          }],
        },
      },
    });
  } catch (error) {
    logger.warn('Failed to patch owner reference for secret', error);
  }
};

const deleteSecret = async (frameworkName) => {
  try {
    await axios({
      method: 'delete',
      url: launcherConfig.secretPath(`${encodeName(frameworkName)}-regcred`),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
    });
  } catch (error) {
    logger.warn('Failed to delete secret', error);
  }
};

const list = async (filters) => {
  // send request to framework controller
  let response;
  try {
    response = await axios({
      method: 'get',
      url: `${launcherConfig.frameworksPath()}?${querystring.stringify(filters)}`,
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      throw error;
    }
  }

  if (response.status === status('OK')) {
    const frameworkList = response.data.items.map(convertFrameworkSummary);
    frameworkList.sort((a, b) => b.createdTime - a.createdTime);
    return frameworkList;
  } else {
    throw createError(response.status, 'UnknownError', response.data.message);
  }
};

const get = async (frameworkName) => {
  // send request to framework controller
  let response;
  try {
    response = await axios({
      method: 'get',
      url: launcherConfig.frameworkPath(encodeName(frameworkName)),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      throw error;
    }
  }

  if (response.status === status('OK')) {
    return (await convertFrameworkDetail(response.data));
  }
  if (response.status === status('Not Found')) {
    throw createError('Not Found', 'NoJobError', `Job ${frameworkName} is not found.`);
  } else {
    throw createError(response.status, 'UnknownError', response.data.message);
  }
};

const put = async (frameworkName, config, rawConfig, userToken) => {
  const [userName] = frameworkName.split(/~(.+)/);

  const virtualCluster = ('defaults' in config && config.defaults.virtualCluster != null) ?
    config.defaults.virtualCluster : 'default';
  const flag = await userModel.checkUserVC(userName, virtualCluster);
  if (flag === false) {
    throw createError('Forbidden', 'ForbiddenUserError', `User ${userName} is not allowed to do operation in ${virtualCluster}`);
  }
  if (encodeName(frameworkName).length > 63) {
    throw createError('Bad Request', 'BadConfigurationError', 'Job name too long, please try a shorter one.');
  }

  const frameworkDescription = generateFrameworkDescription(frameworkName, virtualCluster, config, rawConfig, userToken);

  // generate image pull secret
  const auths = Object.values(config.prerequisites.dockerimage)
    .filter((dockerimage) => dockerimage.auth != null)
    .map((dockerimage) => dockerimage.auth);
  auths.length && await createSecret(frameworkName, auths);

  // calculate pod priority
  // reference: https://github.com/microsoft/pai/issues/3704
  let jobPriority = 0;
  if (launcherConfig.enabledHived) {
    jobPriority = parseInt(Object.values(config.taskRoles)[0].hivedPodSpec.priority);
    jobPriority = Math.min(Math.max(jobPriority, -1), 126);
  }
  const jobCreationTime = Math.floor(new Date() / 1000) & (Math.pow(2, 23) - 1);
  const podPriority = - (((126 - jobPriority) << 23) + jobCreationTime);
  // create priority class
  await createPriorityClass(frameworkName, podPriority);

  // send request to framework controller
  let response;
  try {
    response = await axios({
      method: 'post',
      url: launcherConfig.frameworksPath(),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
      data: frameworkDescription,
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      // do not await for delete
      auths.length && deleteSecret(frameworkName);
      deletePriorityClass(frameworkName);
      throw error;
    }
  }
  if (response.status !== status('Created')) {
    // do not await for delete
    auths.length && deleteSecret(frameworkName);
    deletePriorityClass(frameworkName);
    throw createError(response.status, 'UnknownError', response.data.message);
  }
  // do not await for patch
  auths.length && patchSecretOwner(frameworkName, response.data.metadata.uid);
  patchPriorityClassOwner(frameworkName, response.data.metadata.uid);
};

const execute = async (frameworkName, executionType) => {
  // send request to framework controller
  let response;
  try {
    const headers = {...launcherConfig.requestHeaders};
    headers['Content-Type'] = 'application/merge-patch+json';
    response = await axios({
      method: 'patch',
      url: launcherConfig.frameworkPath(encodeName(frameworkName)),
      headers,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
      data: {
        spec: {
          executionType: `${executionType.charAt(0)}${executionType.slice(1).toLowerCase()}`,
        },
      },
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      throw error;
    }
  }
  if (response.status !== status('OK')) {
    throw createError(response.status, 'UnknownError', response.data.message);
  }
};

const getConfig = async (frameworkName) => {
  // send request to framework controller
  let response;
  try {
    response = await axios({
      method: 'get',
      url: launcherConfig.frameworkPath(encodeName(frameworkName)),
      headers: launcherConfig.requestHeaders,
      httpsAgent: apiserver.ca && new Agent({ca: apiserver.ca}),
    });
  } catch (error) {
    if (error.response != null) {
      response = error.response;
    } else {
      throw error;
    }
  }

  if (response.status === status('OK')) {
    if (response.data.metadata.annotations && response.data.metadata.annotations.config) {
      return yaml.safeLoad(response.data.metadata.annotations.config);
    } else {
      throw createError('Not Found', 'NoJobConfigError', `Config of job ${frameworkName} is not found.`);
    }
  }
  if (response.status === status('Not Found')) {
    throw createError('Not Found', 'NoJobError', `Job ${frameworkName} is not found.`);
  } else {
    throw createError(response.status, 'UnknownError', response.data.message);
  }
};

const getSshInfo = async (frameworkName) => {
  throw createError('Not Found', 'NoJobSshInfoError', `SSH info of job ${frameworkName} is not found.`);
};

const generateExitDiagnostics = (diag) => {
  if (_.isEmpty(diag)) {
    return null;
  }

  const exitDiagnostics = {
    diagnosticsSummary: diag,
    runtime: null,
    launcher: diag,
  };
  const regex = /matched: (.*)/;
  const matches = diag.match(regex);

  // No container info here
  if (matches === null || matches.length < 2) {
    return exitDiagnostics;
  }

  let podCompletionStatus = null;
  try {
    podCompletionStatus = JSON.parse(matches[1]);
  } catch (error) {
    logger.warn('Get diagnostics info failed', error);
    return exitDiagnostics;
  }

  const summmaryInfo = diag.substring(0, matches.index + 'matched:'.length);
  exitDiagnostics.diagnosticsSummary = summmaryInfo + '\n' + yaml.safeDump(podCompletionStatus);
  exitDiagnostics.launcher = exitDiagnostics.diagnosticsSummary;

  // Get runtime output, set launcher output to null. Otherwise, treat all message as launcher output
  exitDiagnostics.runtime = extractRuntimeOutput(podCompletionStatus);
  if (exitDiagnostics.runtime !== null) {
    exitDiagnostics.launcher = null;
    return exitDiagnostics;
  }

  return exitDiagnostics;
};

const extractRuntimeOutput = (podCompletionStatus) => {
  if (_.isEmpty(podCompletionStatus)) {
    return null;
  }

  let res = null;
  for (const container of podCompletionStatus.containers) {
    if (container.code <= 0) {
      continue;
    }
    const message = container.message;
    if (message == null) {
      continue;
    }
    const anchor1 = /\[PAI_RUNTIME_ERROR_START\]/;
    const anchor2 = /\[PAI_RUNTIME_ERROR_END\]/;
    const match1 = message.match(anchor1);
    const match2 = message.match(anchor2);
    if (match1 !== null && match2 !== null) {
      const start = match1.index + match1[0].length;
      const end = match2.index;
      const output = message.substring(start, end).trim();
      try {
        res = {
          ...yaml.safeLoad(output),
          name: container.name,
        };
      } catch (error) {
        logger.warn('failed to format runtime output:', output, error);
      }
      break;
    }
  }
  return res;
};

const generateExitSpec = (code) => {
  if (!_.isNil(code)) {
    if (!_.isNil(exitSpecMap[code])) {
      return exitSpecMap[code];
    } else {
      if (code > 0) {
        return {
          ...exitSpecMap[positiveFallbackExitCode],
          code,
        };
      } else {
        return {
          ...exitSpecMap[negativeFallbackExitCode],
          code,
        };
      }
    }
  } else {
    return null;
  }
};

// module exports
module.exports = {
  list,
  get,
  put,
  execute,
  getConfig,
  getSshInfo,
};
