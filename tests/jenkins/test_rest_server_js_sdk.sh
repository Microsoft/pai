#!/bin/bash

# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.

cluster_type="$1"
rest_server_uri="$2"

case ${cluster_type} in
  "yarn")
    echo "Skip the API tests for yarn version"
    ;;
  "k8s")
    # install openpai-js-sdk
    sudo apt install nodejs -y
    sudo apt install npm -y
    sudo apt install git -y

    git clone https://github.com/microsoft/openpaisdk
    cd openpaisdk
    npm install
    npm run build
    cd lib

    # get token
    token=""
    until [ ! -z ${token} ]; do
    token=$(curl -sS -X POST -d "username=admin" -d "password=admin-password" -d "expiration=36000" ${rest_server_uri}/api/v2/authn/basic/login | jq -r ".token")
    sleep 10s
    done

cat <<EOT >.test/clusters.json
[
    {
        "alias": "test",
        "rest_server_uri": "${rest_server_uri}/rest-server",
        "username": "admin",
        "password": "admin-password",
        "token": "${token}",
        "https": false
    }
]
EOT

    wget https://raw.githubusercontent.com/microsoft/pai/master/src/rest-server/docs/swagger.yaml
    node tests/common/apiTestCaseGenerator.js -- "swagger.yaml" ".tests/apiTestCase.json"
    sudo npm install -g mocha
    mocha tests/api_tests/**/*.spec.js -t 20000

    cd ../..
    ;;
  *)
    echo "Unknown cluster type ${cluster_type}"
    exit 1
    ;;
esac


