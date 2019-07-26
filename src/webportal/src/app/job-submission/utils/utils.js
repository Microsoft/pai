import {isObject, isEmpty, isNil, isArrayLike} from 'lodash';
import {basename} from 'path';

import {JobBasicInfo} from '../models/job-basic-info';
import {JobTaskRole} from '../models/job-task-role';
import {
  CUSTOM_STORAGE_START,
  CUSTOM_STORAGE_END,
  TEAMWISE_DATA_CMD_START,
  TEAMWISE_DATA_CMD_END,
  TENSORBOARD_CMD_START,
  TENSORBOARD_CMD_END,
  AUTO_GENERATE_NOTIFY,
} from './constants';

const HIDE_SECRET = '******';

export const dispatchResizeEvent = () => {
  window.dispatchEvent(new Event('resize'));
};

export const keyValueArrayReducer = (acc, cur) => {
  acc = {...acc, ...cur};
  return acc;
};

export function removeEmptyProperties(obj) {
  if (!isObject(obj)) {
    return;
  }

  const newObj = {...obj};
  Object.keys(newObj).forEach((key) => {
    const onCheckingElement = newObj[key];
    if (!isEmpty(onCheckingElement)) {
      return;
    }

    // ignore non-array-like primitive type
    if (
      !isObject(onCheckingElement) &&
      !isArrayLike(onCheckingElement) &&
      !isNil(onCheckingElement)
    ) {
      return;
    }

    delete newObj[key];
  });
  return newObj;
}

export function getFileNameFromHttp(url) {
  return basename(url, '.git');
}

export function getProjectNameFromGit(url) {
  return basename(url, '.git');
}

export function getFolderNameFromHDFS(path) {
  return basename(path);
}

export function removePathPrefix(path, prefix) {
  return path.replace(prefix, '');
}

export function addPathPrefix(path, prefix) {
  return prefix.concat(path);
}

function populateComponents(jobInformation, context) {
  const {vcNames} = context;
  const virtualCluster = jobInformation.virtualCluster;
  if (isEmpty(vcNames) || isNil(vcNames.find((vcName) => vcName === virtualCluster))) {
    jobInformation.virtualCluster = 'default';
  }
}

export function getJobComponentsFromConfig(jobConfig, context) {
  if (isNil(jobConfig)) {
    return;
  }

  removeAutoGeneratedCodeFromProtocolTaskRoles(jobConfig);
  const parameters = jobConfig.parameters || [];
  const taskRoles = jobConfig.taskRoles || [];
  const deployments = jobConfig.deployments || [];
  const prerequisites = jobConfig.prerequisites || [];
  const secrets = jobConfig.secrets || {};
  const extras = jobConfig.extras || {};

  const updatedJobInformation = JobBasicInfo.fromProtocol(jobConfig);
  const updatedParameters = Object.keys(parameters).map((key) => {
    return {key: key, value: parameters[key]};
  });
  const updatedSecrets =
    secrets === HIDE_SECRET
      ? []
      : Object.keys(secrets).map((key) => {
        return {key: key, value: secrets[key]};
      });
  const updatedTaskRoles = Object.keys(taskRoles).map((name) =>
    JobTaskRole.fromProtocol(
      name,
      taskRoles[name],
      deployments,
      prerequisites,
      secrets,
    ),
  );
  const updatedExtras = extras;

  populateComponents(updatedJobInformation, context);
  return [
    updatedJobInformation,
    updatedTaskRoles,
    updatedParameters,
    updatedSecrets,
    updatedExtras,
  ];
}

export function getHostNameFromUrl(url) {
  const parser = new URL(url);
  return parser.hostname;
}

export function getPortFromUrl(url) {
  const parser = new URL(url);
  return parser.port;
}

function addPreCommandsToProtocolTaskRoles(protocol, preCommands) {
  Object.keys(protocol.taskRoles).forEach((taskRoleKey) => {
    const taskRole = protocol.taskRoles[taskRoleKey];
    const commands = preCommands.concat(taskRole.commands || []);
    taskRole.commands = commands;
  });
}

function addPostCommandsToProtocolTaskRoles(protocol) {
  // inject TensorBoard port and command
  if (protocol.extras && protocol.extras.tensorBoard) {
    const tensorBoardExtras = protocol.extras.tensorBoard;
    const randomStr = tensorBoardExtras.randomStr;
    const logDirectories = tensorBoardExtras.logDirectories;
    const tensorBoardPort = `tensorBoardPort_${randomStr}`;
    const portList = `--port=$PAI_CONTAINER_HOST_${tensorBoardPort}_PORT_LIST`;
    const logPathList = [];
    Object.keys(logDirectories).forEach((key) => {
      logPathList.push(`${key}:${logDirectories[key]}`);
    });
    const logPath = logPathList.join(',');
    const tensorBoardPostCommands = [
      TENSORBOARD_CMD_START,
      AUTO_GENERATE_NOTIFY,
      `tensorboard --logdir=${logPath} ${portList}`,
      TENSORBOARD_CMD_END,
    ];
    // inject TensorBoard command
    const firstTaskRole = Object.keys(protocol.taskRoles)[0];
    const commands = (protocol.taskRoles[firstTaskRole].commands || []).concat(tensorBoardPostCommands);
    protocol.taskRoles[firstTaskRole].commands = commands;
    // inject TensorBoard port
    const ports = protocol.taskRoles[firstTaskRole].resourcePerInstance.ports || {};
    ports[tensorBoardPort] = 1;
    protocol.taskRoles[firstTaskRole].resourcePerInstance.ports = ports;
  }
}

export async function populateProtocolWithDataCli(user, protocol, jobData) {
  if (!jobData.containData) {
    return;
  }

  const preCommands = await jobData.generateDataCommands(user, protocol.name || '');
  addPreCommandsToProtocolTaskRoles(protocol, preCommands);
  addPostCommandsToProtocolTaskRoles(protocol);
}

function removeTagSection(commands, beginTag, endTag) {
  const beginTagIndex = commands.indexOf(beginTag);
  const endTagIndex = commands.indexOf(
    endTag,
    beginTagIndex + 1,
  );

  if (beginTagIndex !== -1 && endTagIndex !== -1) {
    return commands.filter((_, index) => index < beginTagIndex || index > endTagIndex);
  }

  return commands;
}

function removeAutoGeneratedCodeFromProtocolTaskRoles(protocol) {
  let tensorBoardPort;
  if (protocol.extras && protocol.extras.tensorBoard) {
    const randomStr = protocol.extras.tensorBoard.randomStr;
    tensorBoardPort = `tensorBoardPort_${randomStr}`;
  }

  Object.keys(protocol.taskRoles).forEach((taskRoleKey) => {
    const taskRole = protocol.taskRoles[taskRoleKey];
    let commands = taskRole.commands || [];
    if (isEmpty(commands)) {
      return;
    }
    // remove precommands
    commands = removeTagSection(
      commands,
      CUSTOM_STORAGE_START,
      CUSTOM_STORAGE_END,
    );
    commands = removeTagSection(
      commands,
      TEAMWISE_DATA_CMD_START,
      TEAMWISE_DATA_CMD_END,
    );
    // remove port
    if (tensorBoardPort !== undefined) {
      if (taskRole.resourcePerInstance.ports) {
        const ports = taskRole.resourcePerInstance.ports;
        if (ports.hasOwnProperty(tensorBoardPort)) {
          delete ports[tensorBoardPort];
          taskRole.resourcePerInstance.ports = ports;
        }
      }
    }
    // remove postcommands
    commands = removeTagSection(
      commands,
      TENSORBOARD_CMD_START,
      TENSORBOARD_CMD_END,
    );
    taskRole.commands = commands;
  });
}

// The help function to create unique name, the name will be namePrefix_index
export function createUniqueName(usedNames, namePrefix, startindex) {
  let index = startindex;
  let name = `${namePrefix}_${index++}`;
  while (usedNames.find((usedName) => usedName === name)) {
    name = `${namePrefix}_${index++}`;
  }
  return [name, index];
}
