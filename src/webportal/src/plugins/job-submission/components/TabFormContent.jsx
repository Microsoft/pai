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

import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {FormTextFiled} from './FormTextFiled';
import {DockerSection} from './DockerSection';
import {PortsList} from './PortsList';
import {FormPage} from './FormPage';
import {JobTaskRole} from '../models/jobTaskRole';
import {CompletionSection} from './CompletionSection';
import {DeploymentSection} from './DeploymentSection';
import {FormSpinButton} from './FormSpinButton';
import {ContainerSizeSection} from './ContainerSizeSection';

export const TabFormContent = (props) => {
  const {defaultValue, onContentChange} = props;
  const [jobTaskRole, setJobTaskRole] = useState(defaultValue);

  const _onValueChange = (propertyName, propertyValue) => {
    const udpatedJobTaskRole = new JobTaskRole(jobTaskRole);
    udpatedJobTaskRole[propertyName] = propertyValue;
    if (onContentChange !== undefined) {
      onContentChange(udpatedJobTaskRole);
    }
    setJobTaskRole(udpatedJobTaskRole);
  };

  const _onValuesChange = (updateProperties) => {
    let udpatedJobTaskRole = {...jobTaskRole, ...updateProperties};
    udpatedJobTaskRole = new JobTaskRole(udpatedJobTaskRole);
    if (onContentChange !== undefined) {
      onContentChange(udpatedJobTaskRole);
    }
    setJobTaskRole(udpatedJobTaskRole);
  };

  return (
    <FormPage>
      <FormTextFiled sectionLabel={'Task role name'}
                     value={jobTaskRole.name}
                     onChange={(value) => _onValueChange('name', value)}
                     textFiledProps={{placeholder: 'Enter task role name...'}}/>
      <DockerSection defaultValue={jobTaskRole.dockerInfo}
                     onValueChange={(dockerInfo) => _onValueChange('dockerInfo', dockerInfo)}/>
      <FormSpinButton sectionLabel={'Instances'}
                      textFiledProps={{placeholder: 'Enter instance number...'}}
                      value={jobTaskRole.instances}
                      onChange={(value) => _onValueChange('instances', value)}/>
      <ContainerSizeSection defaultValue={jobTaskRole.containerSize}
                            onEnable={(checked) => _onValuesChange({
                              isContainerSizeEnabled: checked,
                              containerSize: jobTaskRole.containerSize.getResetContainerSize(),
                            })}
                            onChange={(containerSize) => _onValueChange('containerSize', containerSize)}
                            isContainerSizeEnabled={jobTaskRole.isContainerSizeEnabled}/>
      <PortsList defaultValue={jobTaskRole.ports}
                 ports={jobTaskRole.ports}
                 onPortsChange={(ports) => _onValueChange('ports', ports)}/>
      <FormSpinButton sectionLabel={'Task retry count'}
                      sectionOptional
                      value={jobTaskRole.taskRetryCount}
                      onChange={(value)=>_onValueChange('taskRetryCount', value)}/>
      <CompletionSection onChange={(completion)=>_onValueChange('completion', completion)}
                         defaultValue={jobTaskRole.completion}/>
      <FormTextFiled sectionLabel={'Command'}
                     multiline={true}
                     rows={10}
                     value={jobTaskRole.command}
                     onChange={(value) => _onValueChange('command', value)}/>
      <DeploymentSection value={jobTaskRole.deployment}
                         onChange={(deployment) => _onValueChange('deployment', deployment)}/>
    </FormPage>
  );
};

TabFormContent.propTypes = {
  defaultValue: PropTypes.instanceOf(JobTaskRole).isRequired,
  onContentChange: PropTypes.func,
};
