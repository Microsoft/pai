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

// module dependencies
const Ajv = require('ajv');
const _ = require('lodash');
const ajv = new Ajv({ allErrors: true, useDefaults: true });

// hived V2 schema
const hivedSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    extras: {
      type: 'object',
      additionalProperties: true,
      properties: {
        hivedScheduler: {
          type: 'object',
          properties: {
            jobPriorityClass: {
              enum: ['crit', 'prod', 'test', 'oppo'],
              default: 'test',
            },
            taskRoles: {
              minProperties: 1,
              patternProperties: {
                '^[A-Za-z0-9._~]+$': {
                  type: 'object',
                  additionalProperties: false,
                  required: ['resourcePerInstance'],
                  properties: {
                    pinnedCellId: {
                      type: ['string', 'null'],
                      default: null,
                    },
                    resourcePerInstance: {
                      type: 'object',
                      properties: {
                        skuNum: {
                          type: ['integer', 'null'],
                          default: null,
                        },
                        skuType: {
                          type: ['string', 'null'],
                          default: null,
                        },
                      },
                    },
                    withinOne: {
                      type: ['string', 'null'],
                      default: null,
                    },
                  },
                },
              },
            },
            taskRoleGroups: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['taskRoles'],
                properties: {
                  taskRoles: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'string',
                    },
                  },
                  withinOne: {
                    type: ['string', 'null'],
                    default: null,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const hivedValidate = ajv.compile(hivedSchema);

const schemaValidate = (protocolObj) => {
  // For V2 schema, we do validating and defaulting in this function.
  // This function will fill in default values for all fields, except that
  // skuType, skuNum, pinnedCellId, withinOne could be null:
  //      1. skuType = null means all sku types in this VC (for oppo job, in all VCs) are acceptable.
  //      2. skuNum = null means we should calculate it from resourcePerInstance
  //      3. pinnedCellId = null means we don't use the pinned cell.
  //      4. withinOne = null means we don't need the tasks/taskroles within one certain cell.

  // set extras.hivedScheduler to let the defaulting happen
  if (!_.has(protocolObj, 'extras.hivedScheduler')) {
    _.set(protocolObj, 'extras.hivedScheduler', {});
  }
  // extras.hivedScheduler.taskRoles.<taskrole> can be missing for some taskroles.
  // we set the following default value for these taskroles.
  // <taskrole_name>:
  //    pinnedCellId: null
  //    resourcePerInstance:
  //      skuNum: null
  //      skuType: null
  const hivedConfig = _.get(protocolObj, 'extras.hivedScheduler');
  for (const taskRole of _.keys(_.get(protocolObj, 'taskRoles', {}))) {
    if (!_.has(hivedConfig, ['taskRoles', taskRole])) {
      _.set(hivedConfig, ['taskRoles', taskRole], {
        pinnedCellId: null,
        resourcePerInstance: {
          skuNum: null,
          skuType: null,
        },
      });
    }
  }
  if (!hivedValidate(protocolObj)) {
    return [false, hivedValidate.errors];
  }
  // all taskroles in extras.hivedScheduler.taskRoles must appear in job's taskRoles
  for (const taskRole of _.keys(_.get(hivedConfig, 'taskRoles', {}))) {
    if (!_.has(protocolObj, ['taskRoles', taskRole])) {
      return [
        false,
        `Task role ${taskRole} found in extras.hivedScheduler.taskRoles but not specified in the job!`,
      ];
    }
    const pinnedCellId = hivedConfig.taskRoles[taskRole].pinnedCellId;
    const skuType = hivedConfig.taskRoles[taskRole].resourcePerInstance.skuType;
    if (skuType != null && pinnedCellId != null) {
      return [
        false,
        `Taskrole ${taskRole} has both skuType and pinnedCellId, only one is allowed.`,
      ];
    }
  }
  // All taskroles in extras.hivedScheduler.taskRoleGroups must appear in job's taskRoles.
  // Also, all task role groups should have at least 2 memebers and have no overlap.
  const includedTaskRoles = new Set();
  for (const taskRoleGroup of _.get(hivedConfig, 'taskRoleGroups', [])) {
    if (taskRoleGroup.taskRoles.length === 1) {
      return [
        false,
        'Task role group in extras.hivedScheduler.taskRoleGroups must have at least 2 members!',
      ];
    }
    for (const taskRole of taskRoleGroup.taskRoles) {
      if (!_.has(protocolObj, ['taskRoles', taskRole])) {
        return [
          false,
          `Task role ${taskRole} found in extras.hivedScheduler.taskRoleGroups but not specified in the job!`,
        ];
      }
      if (includedTaskRoles.has(taskRole)) {
        return [
          false,
          `There is an overlap in extras.hivedScheduler.taskRoleGroups!`,
        ];
      }
      includedTaskRoles.add(taskRole);
    }
  }
  return [true, ''];
};

// module exports
module.exports = {
  schemaValidate: schemaValidate,
};
