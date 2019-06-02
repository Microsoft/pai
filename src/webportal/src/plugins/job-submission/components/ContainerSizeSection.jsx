/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import {Toggle, Stack, SpinButton} from 'office-ui-fabric-react';
import {marginSize} from './formStyle';
import PropTypes from 'prop-types';
import {BasicSection} from './BasicSection';
import {ContainerSize} from '../models/containerSize';

export const ContainerSizeSection = (props) => {
  const {value, onChange, isContainerSizeEnabled, onEnable} = props;
  const {cpu, memoryMB, gpu, shmMB} = value;

  const _onContainerSizeChange = (oriValue, keyName, newValue) => {
    if (onChange === undefined) {
      return;
    }
    const containerSize = new ContainerSize(oriValue);
    containerSize[keyName] = newValue;
    onChange(containerSize);
  };

  const _onChange = _onContainerSizeChange.bind(null, value);
  const _onEnable = (_, checked) => {
    if (onEnable === undefined) {
      return;
    }
    onEnable(checked);
  };

  const _onIncrement = (keyName, value) => _onChange(keyName, +value + 1);
  const _onDecrement = (keyName, value) => _onChange(keyName, +value - 1);
  const _onValidate = (keyName, value) => _onChange(keyName, value);

  return (
    <BasicSection label={'ContainerSize'}>
      <Stack gap={marginSize.s1}>
        <Stack horizontal>
          <SpinButton label={'GPU count'}
                      styles={{labelWrapper: {width: '20%'}, root: {width: '80%'}}}
                      value={gpu}
                      onIncrement={(value)=>_onIncrement('gpu', value)}
                      onDecrement={(value)=>_onDecrement('gpu', value)}
                      onValidate={(value)=>_onValidate('gpu', value)}/>
          <Toggle checked={isContainerSizeEnabled}
                  label='Custom'
                  inlineLabel={true}
                  styles={{label: {order: -1, marginRight: '4px'}}}
                  onChange={_onEnable}/>
        </Stack>
        {/* TODO Extra spin button to simplify the on change function */}
        <SpinButton label={'CPU count'}
                    styles={{labelWrapper: {width: '20%'}, root: {width: '80%'}}}
                    disabled={!isContainerSizeEnabled}
                    value={cpu}
                    onIncrement={(value)=>_onIncrement('cpu', value)}
                    onDecrement={(value)=>_onDecrement('cpu', value)}
                    onValidate={(value)=>_onValidate('cpu', value)}/>
        <SpinButton label={'Memory (MB)'}
                    styles={{labelWrapper: {width: '20%'}, root: {width: '80%'}}}
                    disabled={!isContainerSizeEnabled}
                    value={memoryMB}
                    onIncrement={(value)=>_onIncrement('memoryMB', value)}
                    onDecrement={(value)=>_onDecrement('memoryMB', value)}
                    onValidate={(value)=>_onValidate('memoryMB', value)}/>
        <SpinButton label={'Shared memory (MB)'}
                    styles={{labelWrapper: {width: '20%'}, root: {width: '80%'}}}
                    value={shmMB}
                    disabled={!isContainerSizeEnabled}
                    onIncrement={(value)=>_onIncrement('shmMB', value)}
                    onDecrement={(value)=>_onDecrement('shmMB', value)}
                    onValidate={(value)=>_onValidate('shmMB', value)}/>
      </Stack>
    </BasicSection>
  );
};

ContainerSizeSection.propTypes = {
  value: PropTypes.instanceOf(ContainerSize).isRequired,
  onChange: PropTypes.func,
  isContainerSizeEnabled: PropTypes.bool,
  onEnable: PropTypes.func,
};
