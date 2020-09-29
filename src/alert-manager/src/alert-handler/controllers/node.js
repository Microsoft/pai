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

const k8s = require('@kubernetes/client-node');
const kc = new k8s.KubeConfig();
const logger = require('@alert-handler/common/logger');

kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const cordonNodes = (req, res) => {
  logger.info(
    'alert-handler received `cordonNode` post request from alert-manager.',
  );

  logger.info(req.body);

  // cordon nodes
  req.body.alerts.forEach(function (alert) {
    if (alert.status === 'firing') {
      const node = alert.labels.host_name;
      // set the node unschedulable
      k8sApi
        .patchNode(node, { spec: { unschedulable: true } })
        .then(function () {
          logger.info(`alert-handler successfully cordon node ${node}`);
        })
        .catch(function (data) {
          logger.error(`alert-handler failed to cordon node ${node}`);
          logger.error(data);
          res.status(500).json({
            message: `alert-handler failed to cordon node ${node}`,
          });
        });
    }
  });

  res.status(200).json({
    message: `alert-handler successfully cordon nodes`,
  });
};

// module exports
module.exports = {
  cordonNodes,
};