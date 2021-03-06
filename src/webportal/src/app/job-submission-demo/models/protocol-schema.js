// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import Joi from 'joi-browser';
import { PAI_PLUGIN } from '../utils/constants';

export const taskRoleSchema = Joi.object().keys({
  instances: Joi.number()
    .default(1)
    .min(1),
  completion: Joi.object().keys({
    minFailedInstances: Joi.number()
      .min(-1)
      .allow(null)
      .default(1),
    minSucceededInstances: Joi.number()
      .min(-1)
      .allow(null)
      .default(-1),
  }),
  taskRetryCount: Joi.number().default(0),
  // Following dockerImage, data, output and script should ref to prerequisites content
  dockerImage: Joi.string().required(),
  data: Joi.string(),
  output: Joi.string(),
  script: Joi.string(),
  extraContainerOptions: Joi.object().keys({
    shmMB: Joi.number(),
    infiniband: Joi.boolean(),
  }),
  resourcePerInstance: Joi.object()
    .required()
    .keys({
      cpu: Joi.number().required(),
      memoryMB: Joi.number().required(),
      gpu: Joi.number().required(),
      ports: Joi.object().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/, Joi.number()),
    }),
  commands: Joi.array()
    .items(Joi.string())
    .min(1)
    .required(),
});

export const taskRolesSchema = Joi.object().pattern(
  /^[a-zA-Z_][a-zA-Z0-9_]*$/,
  taskRoleSchema.required(),
);

export const prerequisitesSchema = Joi.object().keys({
  protocolVersion: [Joi.string(), Joi.number()],
  name: Joi.string()
    .required()
    .regex(/^[a-zA-Z0-9_-]+$/),
  type: Joi.string()
    .valid(['data', 'script', 'dockerimage', 'output'])
    .required(),
  contributor: Joi.string(),
  description: Joi.string(),
  auth: Joi.object().keys({
    username: Joi.string(),
    password: Joi.string(),
    registryuri: Joi.string(),
  }),
  uri: Joi.when('type', {
    is: 'data',
    then: Joi.array()
      .items(Joi.string())
      .required(),
    otherwise: Joi.string(),
  }).required(),
  version: [Joi.string(), Joi.number()],
});

const deploymentSchema = Joi.object().keys({
  name: Joi.string()
    .regex(/^[A-Za-z0-9._~]+$/)
    .required(),
  taskRoles: Joi.object()
    .pattern(
      /^[A-Za-z0-9._~]+$/,
      Joi.object().keys({
        preCommands: Joi.array()
          .items(Joi.string())
          .min(1),
        postCommands: Joi.array()
          .items(Joi.string())
          .min(1),
      }),
    )
    .required(),
});

const runtimePluginSchema = Joi.object().keys({
  plugin: Joi.string().required(),
  parameters: Joi.when('plugin', {
    is: 'tensorboard',
    then: Joi.object()
      .keys({
        port: Joi.number().required(),
        logdir: Joi.object().required(),
      })
      .required(),
  })
    .when('plugin', {
      is: 'teamwise_storage',
      then: Joi.object().keys({
        storageConfigNames: Joi.array()
          .min(1)
          .items(Joi.string()),
      }),
    })
    .when('plugin', {
      is: 'ssh',
      then: Joi.object()
        .keys({
          jobssh: Joi.boolean().required(),
          sshbarrier: Joi.boolean(),
          sshbarrierTimeout: Joi.number(),
          userssh: Joi.object().keys({
            type: Joi.string(),
            value: Joi.string(),
          }),
        })
        .required(),
    }),
  failurePolicy: Joi.string().allow('fail', 'ignore'),
});

export const jobProtocolSchema = Joi.object().keys({
  protocolVersion: [Joi.string().required(), Joi.number().required()],
  name: Joi.string().required(),
  type: Joi.string().required(),
  version: [Joi.string(), Joi.number()],
  contributor: Joi.string(),
  description: Joi.string(),

  prerequisites: Joi.array()
    .items(prerequisitesSchema)
    .min(1),

  parameters: Joi.object(),
  secrets: Joi.object(),

  jobRetryCount: Joi.number().default(0),
  taskRoles: taskRolesSchema,
  deployments: Joi.array()
    .items(deploymentSchema)
    .min(1),
  defaults: Joi.object().keys({
    virtualCluster: Joi.string(),
    deployment: Joi.string(),
  }),
  extras: Joi.object()
    .keys({
      submitFrom: Joi.string(),
      [PAI_PLUGIN]: Joi.array().items(runtimePluginSchema),
    })
    .unknown(),
});
