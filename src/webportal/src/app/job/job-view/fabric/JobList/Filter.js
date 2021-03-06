// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const LOCAL_STORAGE_KEY = 'pai-job-filter';

class Filter {
  /**
   * @param {Set<string>?} users
   * @param {Set<string>?} virtualClusters
   * @param {Set<string>?} statuses
   */
  constructor(
    keyword = '',
    priorities = new Set(),
    users = new Set(),
    virtualClusters = new Set(),
    statuses = new Set(),
  ) {
    this.keyword = keyword;
    this.priorities = priorities;
    this.users = users;
    this.virtualClusters = virtualClusters;
    this.statuses = statuses;

    this._cachedJob = null;
  }

  save() {
    const content = JSON.stringify({
      users: Array.from(this.users),
      priorities: Array.from(this.priorities),
      virtualClusters: Array.from(this.virtualClusters),
      statuses: Array.from(this.statuses),
      keyword: this.keyword,
    });
    window.localStorage.setItem(LOCAL_STORAGE_KEY, content);
  }

  load() {
    try {
      const content = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      const {
        priorities,
        users,
        virtualClusters,
        statuses,
        keyword,
      } = JSON.parse(content);
      if (Array.isArray(users)) {
        this.users = new Set(users);
      }
      if (Array.isArray(priorities)) {
        this.priorities = new Set(priorities);
      }
      if (Array.isArray(virtualClusters)) {
        this.virtualClusters = new Set(virtualClusters);
      }
      if (Array.isArray(statuses)) {
        this.statuses = new Set(statuses);
      }
      this.keyword = keyword || '';
    } catch (e) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  apply() {
    const { keyword, priorities, users, virtualClusters, statuses } = this;

    const query = {};
    if (keyword && keyword !== '') {
      query.keyword = keyword;
    }
    if (users && users.size > 0) {
      query.username = Array.from(users).join(',');
    }
    if (priorities && priorities.size > 0) {
      query.jobPriority = Array.from(priorities)
        .map(priority => {
          switch (priority) {
            case 'Opportunistic':
              return 'oppo';
            case 'Product':
              return 'prod';
            case 'Test':
              return 'test';
            default:
              return 'default';
          }
        })
        .join(',');
    }
    if (virtualClusters && virtualClusters.size > 0) {
      query.vc = Array.from(virtualClusters).join(',');
    }
    if (statuses && statuses.size > 0) {
      query.state = Array.from(statuses)
        .join(',')
        .toUpperCase();
    }

    return query;
  }
}

export default Filter;
