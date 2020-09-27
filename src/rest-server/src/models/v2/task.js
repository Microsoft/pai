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
const logger = require('@pai/config/logger');
const databaseModel = require('@pai/utils/dbUtils');
const convertToTaskDetail = require('@pai/utils/frameworkConverter')
  .convertToTaskDetail;
const encodeName = require('@pai/utils/name').encodeName;

const get = async (frameworkName, jobAttemptIndex, taskRoleName, taskIndex) => {
  // get last task attempt by querying Framework / FrameworkHistory table
  let attemptFramework;
  let framework;
  const encodedFrameworkName = encodeName(frameworkName);

  try {
    framework = await databaseModel.Framework.findOne({
      attributes: ['snapshot'],
      where: { name: encodedFrameworkName },
    });
  } catch (error) {
    logger.error(
      `error when getting framework from database: ${error.message}`,
    );
    throw error;
  }

  if (framework) {
    attemptFramework = JSON.parse(framework.snapshot);
  } else {
    logger.warn(
      `could not get framework ${encodedFrameworkName} from database.`,
    );
    return { status: 404, data: null };
  }

  // when attemptIndex is not the last attempt, get the framework attempt from frameworkHistory table
  if (jobAttemptIndex < attemptFramework.spec.retryPolicy.maxRetryCount) {
    const historyFramework = await databaseModel.FrameworkHistory.findOne({
      attributes: ['snapshot'],
      where: {
        frameworkName: encodedFrameworkName,
        attemptIndex: jobAttemptIndex,
      },
    });

    if (!historyFramework) {
      return { status: 404, data: null };
    } else {
      attemptFramework = JSON.parse(historyFramework.snapshot);
    }
  } else if (
    jobAttemptIndex > attemptFramework.spec.retryPolicy.maxRetryCount
  ) {
    return { status: 404, data: null };
  }

  // set task level info with `attemptFramework`
  let taskStatus;
  const taskRoleStatus = attemptFramework.status.attemptStatus.taskRoleStatuses.find(
    (taskRoleStatus) => taskRoleStatus.name === taskRoleName,
  );
  if (taskRoleStatus) {
    taskStatus = taskRoleStatus.taskStatuses.find(
      (taskRoleStatus) => taskRoleStatus.index === taskIndex,
    );
  }
  if (taskStatus === undefined) {
    return { status: 404, data: null };
  }

  // get task attempt history by querying TaskHistory table
  const taskUid = taskStatus.instanceUID;
  let taskHistories;
  try {
    taskHistories = await databaseModel.TaskHistory.findAll({
      attributes: ['snapshot'],
      where: { taskUid: taskUid },
    });
  } catch (error) {
    logger.error(`error when getting task from database: ${error.message}`);
    throw error;
  }

  if (taskHistories) {
    taskHistories = taskHistories.map((taskHistory) =>
      JSON.parse(taskHistory.snapshot),
    );
  }

  const taskDetail = await convertToTaskDetail(
    attemptFramework,
    taskRoleName,
    taskStatus,
    taskHistories,
  );
  return { status: 200, data: taskDetail };
};

module.exports = {
  get,
};
