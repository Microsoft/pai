import { PrimaryButton } from 'office-ui-fabric-react';
import React from 'react';
import { connect } from 'react-redux';
import { Flex } from '../elements';

const PureSubmissionSection = ({ jobProtocol, ...restProps }) => {
  const onSubmit = () => {
    console.log('submit jobProtocol:', jobProtocol);
  };

  return (
    <>
      <PrimaryButton onClick={onSubmit}>Submit</PrimaryButton>
    </>
  );
};

export const SubmissionSection = connect(({ jobInformation }) => ({
  jobProtocol: jobInformation.jobProtocol,
}))(PureSubmissionSection);
