// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PAIV2 } from '@microsoft/openpai-js-sdk';
import * as querystring from 'querystring';

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { debounce, isEmpty } from 'lodash';

import { ColorClassNames, getTheme } from '@uifabric/styling';
import { Fabric } from 'office-ui-fabric-react/lib/Fabric';
import {
  MessageBar,
  MessageBarType,
} from 'office-ui-fabric-react/lib/MessageBar';
import { Stack } from 'office-ui-fabric-react/lib/Stack';

import Context from './Context';
import Filter from './Filter';
import Ordering from './Ordering';
import Pagination from './Pagination';
import Paginator from './Paginator';
import Table from './Table';
import TopBar from './TopBar';

import webportalConfig from '../../../../config/webportal.config';
import { clearToken } from '../../../../user/user-logout/user-logout.component';
import userAuth from '../../../../user/user-auth/user-auth.component';

export default function JobList() {
  const admin = userAuth.checkAdmin();
  const username = cookies.get('user');

  const [allJobs, setAllJobs] = useState(null);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [error, setError] = useState(null);

  const initialFilter = useMemo(() => {
    const query = querystring.parse(location.search.replace(/^\?/, ''));
    if (['vcName', 'status', 'user', 'keyword'].some(x => !isEmpty(query[x]))) {
      const queryFilter = new Filter();
      if (query.vcName) {
        queryFilter.virtualClusters = new Set([query.vcName]);
      }
      if (query.status) {
        queryFilter.statuses = new Set([query.status]);
      }
      if (query.user) {
        queryFilter.users = new Set([query.user]);
      }
      if (query.keyword) {
        queryFilter.keyword = query.user;
      }
      return queryFilter;
    } else {
      const initialFilterUsers =
        username && !admin ? new Set([username]) : undefined;
      const filter = new Filter(undefined, initialFilterUsers);
      filter.load();
      return filter;
    }
  });

  const initialPagination = useMemo(() => {
    const query = querystring.parse(location.search.replace(/^\?/, ''));
    if (!isEmpty(query.pageIndex) || !isEmpty(query.itemsPerPage)) {
      const res = new Pagination(
        query.itemsPerPage,
        query.pageIndex > 0 ? query.pageIndex - 1 : 0,
      );
      res.save();
      return res;
    } else {
      const res = new Pagination();
      res.load();
      return res;
    }
  });

  const [filter, setFilter] = useState(initialFilter);
  const [ordering, setOrdering] = useState(new Ordering());
  const [pagination, setPagination] = useState(initialPagination);
  const [filteredJobsInfo, setFilteredJobsInfo] = useState({
    totalCount: 0,
    data: [],
  });

  const { current: applyFilter } = useRef(
    debounce((/** @type {Filter} */ filter) => {
      pagination.load();
      getJobs({
        ...filter.apply(),
        ...ordering.apply(),
        ...pagination.apply(),
        ...{ withTotalCount: true },
      })
        .then(data => {
          return data;
        })
        .then(setFilteredJobsInfo)
        .catch(err => {
          alert(err.data.message || err.message);
          throw Error(err.data.message || err.message);
        });
    }, 200),
  );

  useEffect(() => {
    applyFilter(filter);
  }, [applyFilter, filter]);

  const { current: applyPagination } = useRef(
    debounce((/** @type {Pagination} */ pagination) => {
      filter.load();
      getJobs({
        ...filter.apply(),
        ...ordering.apply(),
        ...pagination.apply(),
        ...{ withTotalCount: true },
      })
        .then(data => {
          return data;
        })
        .then(setFilteredJobsInfo)
        .catch(err => {
          alert(err.data.message || err.message);
          throw Error(err.data.message || err.message);
        });
    }, 200),
  );

  useEffect(() => {
    applyPagination(pagination);
  }, [applyPagination, pagination]);

  const stopJob = useCallback(
    (...jobs) => {
      userAuth.checkToken(token => {
        jobs.forEach(job => {
          const { name, username } = job;
          const client = new PAIV2.OpenPAIClient({
            rest_server_uri: new URL(
              webportalConfig.restServerUri,
              window.location.href,
            ),
            username: username,
            token: token,
            https: window.location.protocol === 'https:',
          });
          client.job
            .updateJobExecutionType(username, name, 'STOP')
            .then(() => {
              job.executionType = 'STOP';
              delete job._statusText;
              delete job._statusIndex;
              setAllJobs(allJobs.slice());
            })
            .catch(err => {
              if (err.data.code === 'UnauthorizedUserError') {
                alert(err.data.message);
                clearToken();
              } else {
                alert(err.data.message || err.message);
                throw new Error(err.data.message || err.message);
              }
            });
        });
      });
    },
    [allJobs],
  );

  const getJobs = async query => {
    const token = userAuth.checkToken();
    const client = new PAIV2.OpenPAIClient({
      rest_server_uri: new URL(
        webportalConfig.restServerUri,
        window.location.href,
      ),
      username: username,
      token: token,
      https: window.location.protocol === 'https:',
    });

    const url = `${client.cluster.rest_server_uri}/api/v2/jobs`;
    try {
      return await client.httpClient.get(url, undefined, undefined, query);
    } catch (err) {
      alert(err.data.message || err.message);
      throw Error(err.data.message || err.message);
    }
  };

  const refreshJobs = useCallback(function refreshJobs() {
    setFilteredJobsInfo({ totalCount: 0, data: [], pageIndex: 0 });
    getJobs({
      ...filter.apply(),
      ...ordering.apply(),
      ...pagination.apply(),
      ...{ withTotalCount: true },
    })
      .then(data => {
        return data;
      })
      .then(setFilteredJobsInfo)
      .catch(err => {
        alert(err.data.message || err.message);
        throw Error(err.data.message || err.message);
      });
  }, []);

  useEffect(() => filter.save(), [filter]);
  useEffect(refreshJobs, []);

  const context = {
    getJobs,
    filteredJobsInfo,
    refreshJobs,
    selectedJobs,
    setSelectedJobs,
    stopJob,
    username,
    filter,
    setFilter,
    ordering,
    setOrdering,
    pagination,
    setPagination,
  };

  const { spacing } = getTheme();

  return (
    <Context.Provider value={context}>
      <Fabric style={{ height: '100%' }}>
        {error && (
          <div className={ColorClassNames.whiteBackground}>
            <MessageBar
              messageBarType={MessageBarType.blocked}
              onDismiss={() => setError(null)}
              dismissButtonAriaLabel='Close'
            >
              {error}
            </MessageBar>
          </div>
        )}
        <Stack
          verticalFill
          styles={{
            root: {
              position: 'relative',
              padding: `${spacing.s1} ${spacing.l1} ${spacing.l1}`,
            },
          }}
        >
          <Stack.Item>
            <TopBar />
          </Stack.Item>
          <Stack.Item>
            <div style={{ height: spacing.s1 }}></div>
          </Stack.Item>
          <Stack.Item
            grow
            styles={{
              root: {
                height: 0,
                overflow: 'auto',
                backgroundColor: 'white',
                padding: spacing.l1,
              },
            }}
          >
            <Table />
          </Stack.Item>
          <Stack.Item
            styles={{
              root: { backgroundColor: 'white', paddingBottom: spacing.l1 },
            }}
          >
            <Paginator />
          </Stack.Item>
        </Stack>
      </Fabric>
    </Context.Provider>
  );
}
