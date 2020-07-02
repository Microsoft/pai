// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PAIV2 } from '@microsoft/openpai-js-sdk';
import { clearToken } from '../../user/user-logout/user-logout.component.js';
import config from '../../config/webportal.config';
import yaml from 'js-yaml';
import { get } from 'lodash';

const token = cookies.get('token');

const client = new PAIV2.OpenPAIClient({
  rest_server_uri: config.restServerUri,
  username: cookies.get('user'),
  token: token,
});

const wrapper = async func => {
  try {
    return await func();
  } catch (err) {
    if (err.data.code === 'UnauthorizedUserError') {
      alert(err.data.message);
      clearToken();
    } else {
      throw new Error(err.data.message);
    }
  }
};

export class NotFoundError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'NotFoundError';
  }
}

async function fetchWrapper(...args) {
  const res = await fetch(...args);
  const json = await res.json();
  if (res.ok) {
    return json;
  } else {
    if (json.code === 'UnauthorizedUserError') {
      alert(json.message);
      clearToken();
    } else {
      throw new Error(json.message);
    }
  }
}

export async function submitJob(jobProtocol) {
  return fetchWrapper(`${config.restServerUri}/api/v2/jobs`, {
    body: jobProtocol,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/yaml',
    },
    method: 'POST',
  });
}

export async function fetchJobConfig(userName, jobName) {
  const url = `${config.restServerUri}/api/v2/jobs/${userName}~${jobName}/config`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  const json = yaml.safeLoad(text);
  if (res.ok) {
    return json;
  } else {
    if (json.code === 'NoJobConfigError') {
      throw new NotFoundError(json.message);
    } else {
      throw new Error(json.message);
    }
  }
}

export async function listUserVirtualClusters(user) {
  const userInfo = await fetchWrapper(
    `${config.restServerUri}/api/v1/user/${user}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return get(userInfo, 'virtualCluster', []);
}

export async function fetchUserGroup(api, user, token) {
  const userInfoUrl = `${api}/api/v2/user/${user}`;

  return fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(response => {
    if (response.ok) {
      return response.json().then(responseData => {
        return responseData.grouplist;
      });
    } else {
      throw Error(`fetch ${userInfoUrl}: HTTP ${response.status}`);
    }
  });
}

export async function listUserStorageConfigs(user) {
  return wrapper(async () => {
    const userInfo = await client.user.getUser(user);
    return userInfo.storageConfig || [];
  });
}

export async function fetchStorageDetails(configNames) {
  return wrapper(async () => {
    const storageSummary = await client.storage.getStorages();
    const defaultStorages = await client.storage.getStorages(true);
    const defaultStorageNames = defaultStorages.storages.map(x => x.name);
    const details = [];
    for (const storage of storageSummary.storages) {
      if (configNames.includes(storage.name)) {
        const detail = await client.storage.getStorage(storage.name);
        if (defaultStorageNames.includes(detail.name)) {
          detail.default = true;
        }
        details.push(detail);
      }
    }
    return details;
  });
}
