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

import c3 from 'c3';
import c from 'classnames';
import {isNil} from 'lodash';
import PropTypes from 'prop-types';
import {Stack, FontClassNames} from 'office-ui-fabric-react';
import React, {useEffect, useRef, useMemo} from 'react';
import MediaQuery from 'react-responsive';

import Card from './card';

import './c3.scss';
import t from '../../components/tachyons.scss';
import {SHARED_VC_COLOR, DEDICATED_VC_COLOR, BREAKPOINT1, BREAKPOINT2} from './util';

const GpuChart = ({style, gpuPerNode, virtualClusters, userInfo}) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (isNil(chartRef.current)) {
      return;
    }
    // data
    const maxGpu = Math.max(...Object.values(gpuPerNode));
    const processed = {};
    const stack = [];
    const shared = Array.from({length: maxGpu + 1}, () => 0);
    const dedicated = {};
    // data - dedicated
    for (const [name, vc] of Object.entries(virtualClusters)) {
      if (vc.dedicated && vc.nodeList) {
        if (!userInfo.virtualCluster.includes(name)) {
          for (const node of vc.nodeList) {
            processed[node] = true;
          }
        } else {
          const data = Array.from({length: maxGpu + 1}, () => 0);
          for (const node of vc.nodeList) {
            data[gpuPerNode[node]] += 1;
            processed[node] = true;
          }
          dedicated[name] = data;
        }
      }
    }
    // data - shared
    for (const key of Object.keys(gpuPerNode)) {
      if (!processed[key]) {
        shared[gpuPerNode[key]] += 1;
      }
    }
    // data - stack
    stack[0] = ['shared', ...shared.slice(1)];
    stack[1] = Object.values(dedicated).reduce((prev, val) => {
      for (let i = 0; i <= maxGpu; i += 1) {
        prev[i] += val[i];
      }
      return prev;
    }, Array.from({length: maxGpu + 1}, () => 0));
    stack[1][0] = 'dedicated';

    // c3
    const chart = c3.generate({
      bindto: chartRef.current,
      padding: {
        bottom: maxGpu <= 4 ? 16 : 24,
      },
      data: {
        columns: stack,
        type: 'bar',
        groups: [['shared', 'dedicated']],
        labels: {
          format: (x) => x === 0 ? '' : x,
        },
      },
      axis: {
        x: {
          tick: {
            outer: false,
            format: (x) => `Node with ${x + 1}GPU`,
            multiline: true,
            multilineMax: 3,
            width: maxGpu <= 4 ? 80 : 40,
          },
        },
        y: {
          label: {
            text: 'Available #',
            position: 'outer-middle',
          },
          tick: {
            outer: false,
            values: [],
          },
        },
      },
      legend: {
        show: false,
      },
      bar: {
        width: 24,
      },
      color: {
        pattern: [SHARED_VC_COLOR, DEDICATED_VC_COLOR],
      },
    });
    function resize() {
      chart.resize();
    }
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [gpuPerNode, userInfo, virtualClusters]);

  const hasDedicatedVC = useMemo(() => {
    return Object.entries(virtualClusters)
      .filter(([name, info]) => userInfo.virtualCluster.includes(name))
      .some(([name, info]) => info.dedicated);
  }, [userInfo, virtualClusters]);

  return (
    <Card style={style}>
      <Stack styles={{root: [{height: '100%'}]}} gap='l1'>
        <Stack.Item>
          <Stack horizontal horizontalAlign='space-between'>
            <div className={FontClassNames.mediumPlus}>
              Available GPU nodes
            </div>
            <div>
              {hasDedicatedVC && (
                <Stack gap='s2'>
                  <Stack horizontal gap='s1' verticalAlign='center'>
                    <div style={{width: 20, height: 16, backgroundColor: SHARED_VC_COLOR}}></div>
                    <MediaQuery maxWidth={BREAKPOINT1}>
                      <div>Available nodes in shared VC</div>
                    </MediaQuery>
                    <MediaQuery minWidth={BREAKPOINT2}>
                      <div>Available nodes in shared VC</div>
                    </MediaQuery>
                  </Stack>
                  <Stack horizontal gap='s1' verticalAlign='center'>
                    <div style={{width: 20, height: 16, backgroundColor: DEDICATED_VC_COLOR}}></div>
                    <MediaQuery maxWidth={BREAKPOINT1}>
                      <div>Available nodes in dedicated VC</div>
                    </MediaQuery>
                    <MediaQuery minWidth={BREAKPOINT2}>
                      <div>Available nodes in dedicated VC</div>
                    </MediaQuery>
                  </Stack>
                </Stack>
              )}
            </div>
          </Stack>
        </Stack.Item>
        <Stack.Item styles={{root: [t.relative]}} grow>
          <div ref={chartRef} className={c(t.absolute, t.absoluteFill)}>
          </div>
        </Stack.Item>
      </Stack>
    </Card>
  );
};

GpuChart.propTypes = {
  style: PropTypes.object,
  userInfo: PropTypes.object.isRequired,
  gpuPerNode: PropTypes.object.isRequired,
  virtualClusters: PropTypes.object.isRequired,
};

export default GpuChart;
