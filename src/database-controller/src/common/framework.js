// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const logger = require('@dbc/common/logger');
const k8s = require('@dbc/common/k8s');
const _ = require('lodash');
const yaml = require('js-yaml');
const zlib = require('zlib');
const jsonmergepatch = require('json-merge-patch');

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

const mockFailedFrameworkStatus = () => {
  // Mock a failed status for framework.
  // We only use it for frameworks that never start.
  const dateStr = new Date().toISOString();
  return {
    state: 'Completed',
    startTime: dateStr,
    runTime: dateStr,
    transitionTime: dateStr,
    completionTime: dateStr,
    attemptStatus: {
      completionStatus: {
        code: -1100,
        diagnostics:
          'Job is submitted to database, but cannot be created in ApiServer due to permanent failures.',
        phase: 'CreateFrameworkPermanentFailed',
        type: {
          attributes: ['Permanent'],
          name: 'Failed',
        },
        id: 0,
        startTime: dateStr,
        runTime: dateStr,
        completionTime: dateStr,
      },
      taskRoleStatuses: [],
    },
    retryPolicyStatus: {
      retryDelaySec: null,
      totalRetriedCount: 0,
      accountableRetriedCount: 0,
    },
  };
};

const convertFrameworkState = (state, exitCode) => {
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
    case 'AttemptCompleted':
      if (exitCode === -210 || exitCode === -220) {
        return 'STOPPING';
      } else {
        return 'RUNNING';
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

const decompressField = val => {
  if (val == null) {
    return null;
  } else {
    return JSON.parse(zlib.gunzipSync(Buffer.from(val, 'base64')).toString());
  }
};

function logError(err) {
  logger.info('This error will be ignored: ', err);
}

// Class `Snapshot` handles the full json of framework.
// It provides method like:
//    getRequest: extract framework request from the full json
//    overrideRequest: override the framework request to be another snapshot's framework request
//    getRequestUpdate, getStatusUpdate, getAllUpdate: Get database updates from the snapshot.
//       They are used to update database records. e.g. If we want to update the framework request
//       in database, we can do dbModel.update(snapshot.getRequestUpdate(), where: {name: snapshot.getName()})
// It doesn't handle database internal status, like: requestSynced, apiServerDeleted, ..., etc.
class Snapshot {
  constructor(snapshot) {
    if (snapshot instanceof Object) {
      this._snapshot = _.cloneDeep(snapshot);
    } else {
      this._snapshot = JSON.parse(snapshot);
    }
    // If the snapshot doesn't have a status, mock one instead.
    // This usually happens when the framework spec is generated by rest-server.
    if (!this._snapshot.status) {
      this._snapshot.status = mockFrameworkStatus();
    }
  }

  copy() {
    return new Snapshot(this._snapshot);
  }

  getRequest(omitGeneration) {
    // extract framework request from the full json
    const request = _.pick(this._snapshot, [
      'apiVersion',
      'kind',
      'metadata.name',
      'metadata.labels',
      'metadata.annotations',
      'spec',
    ]);
    if (omitGeneration) {
      // User submits framework request to database, and compare this request with the one in database.
      // If the request is the same, no-op. Otherwise set `requestGeneration` = `requestGeneration` + 1.
      // When this kind of comparison happens, we should omit the current `requestGeneration`.
      return _.omit(request, 'metadata.annotations.requestGeneration');
    } else {
      return request;
    }
  }

  overrideRequest(otherSnapshot) {
    // override the framework request to be another snapshot's framework request
    // shouldn't use _.merge here
    _.assign(
      this._snapshot,
      _.pick(otherSnapshot._snapshot, ['apiVersion', 'kind', 'spec']),
    );
    _.assign(
      this._snapshot.metadata,
      _.pick(otherSnapshot._snapshot.metadata, [
        'name',
        'labels',
        'annotations',
      ]),
    );
  }

  unzipTaskRoleStatuses() {
    // Sometimes, `taskRoleStatuses` is too large and can be compressed.
    // This function decompress this field.
    // It is usually called before we write snapshot into database.
    const attemptStatus = this._snapshot.status.attemptStatus;
    if (
      !attemptStatus.taskRoleStatuses &&
      attemptStatus.taskRoleStatusesCompressed
    ) {
      attemptStatus.taskRoleStatuses = decompressField(
        attemptStatus.taskRoleStatusesCompressed,
      );
      attemptStatus.taskRoleStatusesCompressed = null;
    }
  }

  getRequestUpdate(withSnapshot = true) {
    // Get database updates from the snapshot for the request part.
    const loadedConfig = yaml.safeLoad(
      this._snapshot.metadata.annotations.config,
    );
    const jobPriority = _.get(
      loadedConfig,
      'extras.hivedscheduler.jobPriorityClass',
      null,
    );
    // Job status change notification
    const jobStatusChangeNotification = _.get(
      loadedConfig,
      'extras.jobStatusChangeNotification',
      {},
    );
    const update = {
      name: this._snapshot.metadata.name,
      namespace: this._snapshot.metadata.namespace,
      jobName: this._snapshot.metadata.annotations.jobName,
      userName: this._snapshot.metadata.labels.userName,
      jobConfig: this._snapshot.metadata.annotations.config,
      executionType: this._snapshot.spec.executionType,
      virtualCluster: this._snapshot.metadata.labels.virtualCluster,
      jobPriority: jobPriority,
      totalGpuNumber: this._snapshot.metadata.annotations.totalGpuNumber,
      totalTaskNumber: this._snapshot.spec.taskRoles.reduce(
        (num, spec) => num + spec.taskNumber,
        0,
      ),
      totalTaskRoleNumber: this._snapshot.spec.taskRoles.length,
      logPathInfix: this._snapshot.metadata.annotations.logPathInfix,
      notificationAtRunning: _.get(
        jobStatusChangeNotification,
        'running',
        false,
      ),
      notifiedAtRunning: false,
      notificationAtSucceeded: _.get(
        jobStatusChangeNotification,
        'succeeded',
        false,
      ),
      notifiedAtSucceeded: false,
      notificationAtFailed: _.get(jobStatusChangeNotification, 'failed', false),
      notifiedAtFailed: false,
      notificationAtStopped: _.get(
        jobStatusChangeNotification,
        'stopped',
        false,
      ),
      notifiedAtStopped: false,
      notificationAtRetried: _.get(
        jobStatusChangeNotification,
        'retried',
        false,
      ),
      notifiedAtRetried: 0,
    };
    if (withSnapshot) {
      this.unzipTaskRoleStatuses();
      update.snapshot = JSON.stringify(this._snapshot);
    }
    return update;
  }

  getStatusUpdate(withSnapshot = true) {
    // Get database updates from the snapshot for the status part.
    const completionStatus = this._snapshot.status.attemptStatus
      .completionStatus;
    const update = {
      retries: this._snapshot.status.retryPolicyStatus.totalRetriedCount,
      retryDelayTime: this._snapshot.status.retryPolicyStatus.retryDelaySec,
      platformRetries:
        this._snapshot.status.retryPolicyStatus.totalRetriedCount -
        this._snapshot.status.retryPolicyStatus.accountableRetriedCount,
      resourceRetries: 0,
      userRetries: this._snapshot.status.retryPolicyStatus
        .accountableRetriedCount,
      creationTime: this._snapshot.metadata.creationTimestamp
        ? new Date(this._snapshot.metadata.creationTimestamp)
        : null,
      launchTime:
        this._snapshot.status.runTime || this._snapshot.status.completionTime
          ? new Date(
              this._snapshot.status.runTime ||
                this._snapshot.status.completionTime,
            )
          : null,
      completionTime: this._snapshot.status.completionTime
        ? new Date(this._snapshot.status.completionTime)
        : null,
      appExitCode: completionStatus ? completionStatus.code : null,
      subState: this._snapshot.status.state,
      state: convertFrameworkState(
        this._snapshot.status.state,
        completionStatus ? completionStatus.code : null,
      ),
    };
    if (withSnapshot) {
      this.unzipTaskRoleStatuses();
      update.snapshot = JSON.stringify(this._snapshot);
    }
    return update;
  }

  getAllUpdate(withSnapshot = true) {
    // Get database updates from the snapshot for both framework request and status part.
    const update = _.assign(
      {},
      this.getRequestUpdate(false),
      this.getStatusUpdate(false),
    );
    if (withSnapshot) {
      this.unzipTaskRoleStatuses();
      update.snapshot = JSON.stringify(this._snapshot);
    }
    return update;
  }

  getRecordForLegacyTransfer() {
    const record = this.getAllUpdate();
    // correct submissionTime is lost, use snapshot.metadata.creationTimestamp instead
    if (this.hasCreationTime()) {
      record.submissionTime = this.getCreationTime();
    } else {
      record.submissionTime = new Date();
    }
    this.setRequestGeneration(1);
    return record;
  }

  getName() {
    return this._snapshot.metadata.name;
  }

  getState() {
    return this._snapshot.status.state;
  }

  getTotalRetriedCount() {
    return _.get(
      this._snapshot,
      'status.retryPolicyStatus.totalRetriedCount',
      0,
    );
  }

  getSnapshot() {
    return _.cloneDeep(this._snapshot);
  }

  getString() {
    return JSON.stringify(this._snapshot);
  }

  hasCreationTime() {
    if (_.get(this._snapshot, 'metadata.creationTimestamp')) {
      return true;
    } else {
      return false;
    }
  }

  getCreationTime() {
    if (this.hasCreationTime()) {
      return new Date(this._snapshot.metadata.creationTimestamp);
    } else {
      return null;
    }
  }

  setRequestGeneration(generation) {
    this._snapshot.metadata.annotations.requestGeneration = generation.toString();
  }

  getRequestGeneration() {
    // `requestGeneration` is used to track framework request changes and determine whether it is synced with API server.
    // If `requestGeneration` in database equals the one from API server, we will mark the database field `requestSynced` = true.
    if (!_.has(this._snapshot, 'metadata.annotations.requestGeneration')) {
      // for some legacy jobs, use 1 as its requestGeneration.
      this.setRequestGeneration(1);
    }
    return parseInt(this._snapshot.metadata.annotations.requestGeneration);
  }

  applyRequestPatch(patchData) {
    if (patchData.status) {
      // doesn't allow patch status
      delete patchData.status;
    }
    this._snapshot = jsonmergepatch.apply(this._snapshot, patchData);
  }

  setFailed() {
    // Manually set the framework's status to failed.
    // This is used when we cannot sync the framework request to api server,
    // and we're sure that the error is unrecoverable.

    // For now, we only use it for frameworks that never start.
    // Also, requestSynced == false is guaranteed here.
    // Because only call setFailed() from synchronizeHandler() in poller,
    // and synchronizeHandler() is only called for requestSynced=false frameworks.
    if (
      !this.getTotalRetriedCount() === 0 ||
      this.getState() !== 'AttemptCreationPending'
    ) {
      throw new Error('setFailed() only works for framework that never start!');
    }

    this._snapshot.status = mockFailedFrameworkStatus();
  }
}

// Class Add-ons handles creation/patching/deletion of job add-ons.
// Currently there are 5 types of add-ons: configSecret, userExtensionSecret, priorityClass, dockerSecret, and tokenSecret.
class AddOns {
  constructor(
    configSecretDef = null,
    userExtensionSecretDef = null,
    priorityClassDef = null,
    dockerSecretDef = null,
    tokenSecretDef = null,
  ) {
    if (configSecretDef !== null && !(configSecretDef instanceof Object)) {
      this._configSecretDef = JSON.parse(configSecretDef);
    } else {
      this._configSecretDef = configSecretDef;
    }
    if (
      userExtensionSecretDef !== null &&
      !(userExtensionSecretDef instanceof Object)
    ) {
      this._userExtensionSecretDef = JSON.parse(userExtensionSecretDef);
    } else {
      this._userExtensionSecretDef = userExtensionSecretDef;
    }
    if (priorityClassDef !== null && !(priorityClassDef instanceof Object)) {
      this._priorityClassDef = JSON.parse(priorityClassDef);
    } else {
      this._priorityClassDef = priorityClassDef;
    }
    if (dockerSecretDef !== null && !(dockerSecretDef instanceof Object)) {
      this._dockerSecretDef = JSON.parse(dockerSecretDef);
    } else {
      this._dockerSecretDef = dockerSecretDef;
    }
    if (tokenSecretDef !== null && !(tokenSecretDef instanceof Object)) {
      this._tokenSecretDef = JSON.parse(tokenSecretDef);
    } else {
      this._tokenSecretDef = tokenSecretDef;
    }
  }

  async create() {
    if (this._configSecretDef) {
      try {
        await k8s.createSecret(this._configSecretDef);
      } catch (err) {
        if (err.response && err.response.statusCode === 409) {
          logger.warn(
            `Secret ${this._configSecretDef.metadata.name} already exists.`,
          );
        } else {
          throw err;
        }
      }
    }
    if (this._userExtensionSecretDef) {
      try {
        await k8s.createSecret(this._userExtensionSecretDef);
      } catch (err) {
        if (err.response && err.response.statusCode === 409) {
          logger.warn(
            `Secret ${this._userExtensionSecretDef.metadata.name} already exists.`,
          );
        } else {
          throw err;
        }
      }
    }
    if (this._priorityClassDef) {
      try {
        await k8s.createPriorityClass(this._priorityClassDef);
      } catch (err) {
        if (err.response && err.response.statusCode === 409) {
          logger.warn(
            `PriorityClass ${this._priorityClassDef.metadata.name} already exists.`,
          );
        } else {
          throw err;
        }
      }
    }
    if (this._dockerSecretDef) {
      try {
        await k8s.createSecret(this._dockerSecretDef);
      } catch (err) {
        if (err.response && err.response.statusCode === 409) {
          logger.warn(
            `Secret ${this._dockerSecretDef.metadata.name} already exists.`,
          );
        } else {
          throw err;
        }
      }
    }
    if (this._tokenSecretDef) {
      try {
        await k8s.createSecret(this._tokenSecretDef);
      } catch (err) {
        if (err.response && err.response.statusCode === 409) {
          logger.warn(
            `Secret ${this._tokenSecretDef.metadata.name} already exists.`,
          );
        } else {
          throw err;
        }
      }
    }
  }

  silentPatch(frameworkResponse) {
    // do not await for patch
    this._configSecretDef &&
      k8s
        .patchSecretOwnerToFramework(this._configSecretDef, frameworkResponse)
        .catch(logError);
    this._userExtensionSecretDef &&
      k8s
        .patchSecretOwnerToFramework(
          this._userExtensionSecretDef,
          frameworkResponse,
        )
        .catch(logError);
    this._dockerSecretDef &&
      k8s
        .patchSecretOwnerToFramework(this._dockerSecretDef, frameworkResponse)
        .catch(logError);
    this._tokenSecretDef &&
      k8s
        .patchSecretOwnerToFramework(this._tokenSecretDef, frameworkResponse)
        .catch(logError);
  }

  silentDelete() {
    // do not await for delete
    this._configSecretDef &&
      k8s.deleteSecret(this._configSecretDef.metadata.name).catch(logError);
    this._userExtensionSecretDef &&
      k8s
        .deleteSecret(this._userExtensionSecretDef.metadata.name)
        .catch(logError);
    this._priorityClassDef &&
      k8s
        .deletePriorityClass(this._priorityClassDef.metadata.name)
        .catch(logError);
    this._dockerSecretDef &&
      k8s.deleteSecret(this._dockerSecretDef.metadata.name).catch(logError);
    this._tokenSecretDef &&
      k8s.deleteSecret(this._tokenSecretDef.metadata.name).catch(logError);
  }

  getUpdate() {
    const update = {};
    if (this._configSecretDef) {
      update.configSecretDef = JSON.stringify(this._configSecretDef);
    }
    if (this._userExtensionSecretDef) {
      update.userExtensionSecretDef = JSON.stringify(
        this._userExtensionSecretDef,
      );
    }
    if (this._priorityClassDef) {
      update.priorityClassDef = JSON.stringify(this._priorityClassDef);
    }
    if (this._dockerSecretDef) {
      update.dockerSecretDef = JSON.stringify(this._dockerSecretDef);
    }
    if (this._tokenSecretDef) {
      update.tokenSecretDef = JSON.stringify(this._tokenSecretDef);
    }
    return update;
  }
}

async function synchronizeCreate(snapshot, addOns) {
  await addOns.create();
  try {
    const response = await k8s.createFramework(snapshot.getRequest(false));
    // framework is created successfully.
    const frameworkResponse = response.body;
    // don't wait for patching
    addOns.silentPatch(frameworkResponse);
    return frameworkResponse;
  } catch (err) {
    if (err.response && err.response.statusCode === 409) {
      // doesn't delete add-ons if 409 error
      logger.warn(`Framework ${snapshot.getName()} already exists.`);
      throw err;
    } else {
      throw err;
    }
  }
}

async function synchronizeModify(snapshot) {
  const response = await k8s.patchFramework(
    snapshot.getName(),
    snapshot.getRequest(false),
  );
  const frameworkResponse = response.body;
  return frameworkResponse;
}

async function synchronizeRequest(snapshot, addOns) {
  // any error will be raised
  // if succeed, return framework from api server
  // There may be multiple calls of synchronizeRequest.
  // Poller and write-merger uses this method.
  try {
    // Try to modify the framework
    const frameworkResponse = await synchronizeModify(snapshot);
    logger.info(
      `Request of framework ${snapshot.getName()} is successfully patched.`,
    );
    return frameworkResponse;
  } catch (err) {
    // If framework doesn't exist, create it.
    if (err.response && err.response.statusCode === 404) {
      const frameworkResponse = await synchronizeCreate(snapshot, addOns);
      logger.info(
        `Request of framework ${snapshot.getName()} is successfully created.`,
      );
      return frameworkResponse;
    } else {
      throw err;
    }
  }
}

function silentSynchronizeRequest(snapshot, addOns) {
  try {
    // any error will be ignored
    synchronizeRequest(snapshot, addOns).catch(logError);
  } catch (err) {
    logError(err);
  }
}

function silentDeleteFramework(name) {
  try {
    k8s.deleteFramework(name).catch(logError);
  } catch (err) {
    logError(err);
  }
}

module.exports = {
  Snapshot,
  AddOns,
  synchronizeRequest,
  silentSynchronizeRequest,
  silentDeleteFramework,
};
