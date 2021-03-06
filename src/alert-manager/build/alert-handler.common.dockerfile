# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

FROM node:dubnium

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY ./src/alert-handler .

RUN yarn install

ENTRYPOINT ["npm", "start"]
