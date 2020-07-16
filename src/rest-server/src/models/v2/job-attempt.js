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
const crypto = require('crypto');

const {convertToJobAttempt} = require('@pai/utils/frameworkConverter');
const launcherConfig = require('@pai/config/launcher');
const logger = require('@pai/config/logger');
const {sequelize} = require('@pai/utils/postgresUtil');

const convertName = (name) => {
  // convert framework name to fit framework controller spec
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const encodeName = (name) => {
  if (name.startsWith('unknown') || !name.includes('~')) {
    // framework is not generated by PAI
    return convertName(name.replace(/^unknown/g, ''));
  } else {
    // md5 hash
    return crypto.createHash('md5').update(name).digest('hex');
  }
};

if (sequelize && launcherConfig.enabledJobHistory) {
  const healthCheck = async () => {
    try {
      await sequelize.authenticate();
      return true;
    } catch (e) {
      logger.error(e.message);
      return false;
    }
  };

  const list = async (frameworkName) => {
    let attemptData = [];

    const sqlSentence = `SELECT snapshot as data FROM framework_history WHERE ` +
      `frameworkName = '${encodeName(frameworkName)}' ` +
      `ORDER BY uid ASC;`;
    const pgResult = (await sequelize.query(sqlSentence))[0];
    const jobRetries = await Promise.all(
      pgResult.map((row) => {
        return convertToJobAttempt(JSON.parse(row.data));
      }),
    );
    attemptData.push(
      ...jobRetries.map((jobRetry) => {
        return {...jobRetry, isLatest: false};
      }),
    );

    return {status: 200, data: attemptData};
  };

  const get = async (frameworkName, jobAttemptIndex) => {
    let attemptFramework;

    const sqlSentence = `SELECT snapshot as data FROM framework_history WHERE ` +
      `frameworkName = '${encodeName(frameworkName)}' and ` +
      `attemptIndex = '${jobAttemptIndex}' ` +
      `ORDER BY uid ASC;`;

    const pgResult = (await sequelize.query(sqlSentence))[0];

    if (pgResult.length === 0) {
      return {status: 404, data: null};
    } else {
      attemptFramework = JSON.parse(pgResult[0].data);
      const attemptDetail = await convertToJobAttempt(attemptFramework);
      return {status: 200, data: {...attemptDetail, isLatest: false}};
    }
  };

  module.exports = {
    healthCheck,
    list,
    get,
  };
} else {
  module.exports = {
    healthCheck: () => false,
    list: () => {
 throw Error('Unexpected Call');
},
    get: () => {
 throw Error('Unexpected Call');
},
  };
}
