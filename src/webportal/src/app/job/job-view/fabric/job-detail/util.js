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

import {DateTime, Interval} from 'luxon';

export function getHumanizedJobStateString(jobInfo) {
  const status = jobInfo.jobStatus;
  let hjss = '';
  if (status.state === 'JOB_NOT_FOUND') {
    hjss = 'N/A';
  } else if (status.state === 'WAITING') {
    if (status.executionType === 'STOP') {
      hjss = 'Stopping';
    } else {
      hjss = 'Waiting';
    }
  } else if (status.state === 'RUNNING') {
    if (status.executionType === 'STOP') {
      hjss = 'Stopping';
    } else {
      hjss = 'Running';
    }
  } else if (status.state === 'SUCCEEDED') {
    hjss = 'Succeeded';
  } else if (status.state === 'FAILED') {
    hjss = 'Failed';
  } else if (status.state === 'STOPPED') {
    hjss = 'Stopped';
  } else {
    hjss = 'Unknown';
  }
  return hjss;
}

export function getDurationString(jobInfo) {
  const start = jobInfo.jobStatus.createdTime && DateTime.fromMillis(jobInfo.jobStatus.createdTime);
  const end = jobInfo.jobStatus.completedTime && DateTime.fromMillis(jobInfo.jobStatus.completedTime);
  if (start) {
    const dur = Interval.fromDateTimes(start, end || DateTime.utc()).toDuration(['days', 'hours', 'minutes', 'seconds']);
    if (dur.days > 0) {
      return dur.toFormat(`d'd' h'h' m'm' s's'`);
    } else if (dur.hours > 0) {
      return dur.toFormat(`h'h' m'm' s's'`);
    } else if (dur.minutes > 0) {
      return dur.toFormat(`m'm' s's'`);
    } else {
      return dur.toFormat(`s's'`);
    }
  } else {
    return 'N/A';
  }
}


export function printDateTime(dt) {
  if (dt > DateTime.utc().minus({week: 1}) && dt < DateTime.utc().minus({minute: 1})) {
    return `${dt.toRelative()}, ${dt.toLocaleString(DateTime.TIME_24_SIMPLE)}`;
  } else {
    return dt.toLocaleString(DateTime.DATETIME_MED);
  }
}

export function parseGpuAttr(attr) {
  const res = [];
  for (let i = 0; attr !== 0; i++, attr>>=1) {
    if ((attr & 1) === 1) {
      res.push(i);
    }
  }

  return res;
}

export const statusColorMapping = {
  waiting: '#fcd116',
  failed: '#eb1123',
  running: '#0071bc',
  succeeded: '#7fba00',
  unknown: '#b1b5b8',
};
