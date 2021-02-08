import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { isNil, get, set } from 'lodash';
import { JobInformation } from './components/job-information';
import { TaskRole } from './components/task-role';
import { Sidebar } from './components/sidebar';
import { SubmissionSection } from './components/submission-section';
import styled from 'styled-components';
import { Flex, Box, Row, Col } from './elements';
import { fetchJobConfig } from './utils/conn';

const loginUser = cookies.get('user');

function getChecksum(str) {
  let res = 0;
  for (const c of str) {
    res ^= c.charCodeAt(0) & 0xff;
  }
  return res.toString(16);
}

function generateJobName(jobName) {
  let name = jobName;
  if (
    /_\w{8}$/.test(name) &&
    getChecksum(name.slice(0, -2)) === name.slice(-2)
  ) {
    name = name.slice(0, -9);
  }

  let suffix = Date.now().toString(16);
  suffix = suffix.substring(suffix.length - 6);
  name = `${name}_${suffix}`;
  name = name + getChecksum(name);
  return name;
}

const UnwrapperedJobEditPage = props => {
  const { dispatch } = props;

  // fill protocol if cloned job or local storage
  useEffect(() => {
    const fillJobProtocol = jobConfig => {
      dispatch({
        type: 'SAVE_JOBPROTOCOL',
        payload: { ...jobConfig, name: generateJobName(jobConfig.name) },
      });
      if (get(jobConfig, 'extras.submitFrom')) {
        delete jobConfig.extras.submitFrom;
      }
    };
    const params = new URLSearchParams(window.location.search);
    if (params.get('op') === 'resubmit') {
      const jobName = params.get('jobName') || '';
      const user = params.get('user') || '';
      if (user && jobName) {
        fetchJobConfig(user, jobName)
          .then(jobConfig => fillJobProtocol(jobConfig))
          .catch(alert);
      }
    } else if (!isNil(window.localStorage.getItem('marketItem'))) {
      const jobConfig = JSON.parse(localStorage.getItem('marketItem'));
      fillJobProtocol(jobConfig);
      localStorage.removeItem('marketItem');
    }
  }, []);

  // fetch available virtual clusters by login user's authority
  useEffect(() => {
    dispatch({
      type: 'fetchVirtualClusters',
      payload: { loginUser },
    });
  }, []);

  return (
    <>
      {/* left */}
      <Flex flexDirection='column' flex={1}>
        <JobInformation />
        <TaskRole />
      </Flex>
      {/* right */}
        <Sidebar />
    </>
  );
};

export const JobEditPage = connect(({ jobInformation, global }) => ({
  ...jobInformation,
  ...global,
}))(UnwrapperedJobEditPage);
