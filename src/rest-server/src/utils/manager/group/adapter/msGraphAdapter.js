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
const { catch } = require('@pai/server');
const axios = require('axios');

function initConfig(msGraphUrl, accessToken) {
  return {
    msGraphAPI: `${msGraphUrl}v1.0/me/transitiveMemberOf`,
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getUserGroupList(username, config) {
  const responseData = [];
  let requestUrl = config.msGraphAPI;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const response = await axios.get(requestUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: config.Authorization,
        },
      });
      responseData.push(response.data.value);
      if ('@odata.nextLink' in response.data) {
        requestUrl = response.data['@odata.nextLink'];
      } else {
        break;
      }
    } catch (err) {
      logger.warn('request config is', config, err);
    }
  }
  const groupList = [];
  for (const dataBlock of responseData) {
    for (const groupItem of dataBlock) {
      if (groupItem.mailNickname) {
        groupList.push(groupItem.mailNickname);
      }
    }
  }
  return groupList;
}

module.exports = {
  initConfig,
  getUserGroupList,
};
