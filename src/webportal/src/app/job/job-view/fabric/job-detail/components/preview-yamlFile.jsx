/*
 * Copyright (c) Microsoft Corporation
 * All rights reserved.
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
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

import React, { useState, useCallback, useContext } from 'react';
import { DefaultButton, Stack } from 'office-ui-fabric-react';
import { isNil } from 'lodash';
import yaml from 'js-yaml';

import Context from './context';
import MonacoPanel from '../../../../../components/monaco-panel';

const PreviewYamlFile = props => {
  const { rawJobConfig } = useContext(Context);

  const [monacoProps, setMonacoProps] = useState(null);
  const [modalTitle, setModalTitle] = useState('');

  const isJobV2 = jobConfig => {
    return (
      !isNil(jobConfig.protocol_version) || !isNil(jobConfig.protocolVersion)
    );
  };

  const showEditor = useCallback((title, props) => {
    setMonacoProps(props);
    setModalTitle(title);
  });

  const showJobConfig = useCallback(() => {
    if (isJobV2(rawJobConfig)) {
      showEditor('Job Config', {
        language: 'yaml',
        value: yaml.safeDump(rawJobConfig),
      });
    } else {
      showEditor('Job Config', {
        language: 'json',
        value: JSON.stringify(rawJobConfig, null, 2),
      });
    }
  }, []);

  const onDismiss = useCallback(() => {
    setModalTitle('');
    setMonacoProps(null);
  }, []);

  return (
    <Stack horizontal verticalAlign='baseline' gap='m'>
      <DefaultButton text='preview yaml file' onClick={showJobConfig} />
      <MonacoPanel
        isOpen={!isNil(monacoProps)}
        onDismiss={onDismiss}
        title={modalTitle}
        monacoProps={monacoProps}
      />
    </Stack>
  );
};

export default PreviewYamlFile;
