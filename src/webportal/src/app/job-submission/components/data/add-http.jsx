import React, {useState} from 'react';
import {IconButton, Stack, TextField} from 'office-ui-fabric-react';
import {cloneDeep} from 'lodash';
import PropTypes from 'prop-types';

import {STORAGE_PREFIX} from '../../utils/constants';
import {InputData} from '../../models/data/input-data';

export const AddHttp = (props) => {
  const {dataList, setDataList, setDataType} = props;
  const [mountPath, setMountPath] = useState();
  const [httpUrl, setHttpUrl] = useState();
  const [containerPathErrorMessage, setContainerPathErrorMessage] = useState();
  const [httpAddressErrorMessage, setHttpAddressErrorMessage] = useState();

  const submitMount = () => {
    const newMountList = cloneDeep(dataList);
    newMountList.push(new InputData(mountPath, httpUrl, 'http'));
    setDataList(newMountList);
    setDataType('none');
  };

  return (
    <Stack horizontal horizontalAlign='space-between'>
      <TextField
        required
        prefix={STORAGE_PREFIX}
        label='Container Path'
        styles={{
          root: {
            minWidth: 200,
            marginBottom: httpAddressErrorMessage
              ? containerPathErrorMessage
                ? 0
                : 22.15
              : 0,
          },
        }}
        onChange={(_event, newValue) => {
          if (!newValue) {
            setContainerPathErrorMessage('Container path should not be empty');
          } else if (!newValue.startsWith('/')) {
            setContainerPathErrorMessage('container path should start with /');
          } else {
            setContainerPathErrorMessage(null);
            setMountPath(`${STORAGE_PREFIX}${newValue}`);
          }
        }}
      />
      <TextField
        required
        label='Http Address'
        styles={{
          root: {
            minWidth: 230,
            marginBottom: containerPathErrorMessage
              ? httpAddressErrorMessage
                ? 0
                : 22.15
              : 0,
          },
        }}
        onChange={(_event, newValue) => {
          setHttpUrl(newValue);
        }}
      />
      <Stack.Item align='end'>
        <IconButton
          iconProps={{iconName: 'Accept'}}
          onClick={submitMount}
          styles={{
            root: {
              marginBottom:
                httpAddressErrorMessage || containerPathErrorMessage
                  ? 22.15
                  : 0,
            },
          }}
        />
      </Stack.Item>
      <Stack.Item align='end'>
        <IconButton
          iconProps={{iconName: 'Cancel'}}
          onClick={() => {
            setDataType('none');
          }}
          styles={{
            root: {
              marginBottom:
                httpAddressErrorMessage || containerPathErrorMessage
                  ? 22.15
                  : 0,
            },
          }}
        />
      </Stack.Item>
    </Stack>
  );
};

AddHttp.propTypes = {
  dataList: PropTypes.arrayOf(PropTypes.instanceOf(InputData)),
  setDataList: PropTypes.func,
  setDataType: PropTypes.func,
};
