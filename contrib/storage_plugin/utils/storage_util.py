#!/usr/bin/env python
# Copyright (c) Microsoft Corporation
# All rights reserved.
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
# documentation files (the "Software"), to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
# to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
# BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
# DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import os
import sys
import time
import logging
import logging.config
import base64

from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException

logger = logging.getLogger(__name__)

# List usernames from pai-user secrets
def get_pai_users():
    users = []
    config.load_kube_config()
    api_instance = client.CoreV1Api()

    try:
        api_response = api_instance.list_namespaced_secret("pai-user")
        for item in api_response.items:
            users.append(base64.b64decode(item.data["username"]))

    except ApiException as e:
        if e.status == 404:
            logger.info("Couldn't find secret in namespace pai-user, exit")
            sys.exit(1)
        else:
            logger.error("Exception when calling CoreV1Api->list_namespaced_secret: {0}".format(str(e)))
            sys.exit(1)

    return users


def get_storage_config_files(storage_config_name):
    # List storage users
    data = get_storage_config(storage_config_name, "default")
    if data != None:
        files = []
        for item in data.keys():
            files.append(item)
        return files
    else:
        return None


def update_configmap(name, data_dict, namespace):
    config.load_kube_config()
    api_instance = client.CoreV1Api()

    meta_data = client.V1ObjectMeta()
    meta_data.namespace = namespace
    meta_data.name = name
    body = client.V1ConfigMap(
                metadata = meta_data,
                data = data_dict)

    try:
        api_response = api_instance.patch_namespaced_config_map(name, namespace, body)
        logger.info("configmap named {0} is updated.".format(name))
    except ApiException as e:
        if e.status == 404:
            try:
                logger.info("Couldn't find configmap named {0}. Create a new configmap".format(name))
                api_response = api_instance.create_namespaced_config_map(namespace, body)
                logger.info("Configmap named {0} is created".format(name))
            except ApiException as ie:
                logger.error("Exception when calling CoreV1Api->create_namespaced_config_map: {0}".format(str(e)))
                sys.exit(1)
        else:
            logger.error("Exception when calling CoreV1Api->patch_namespaced_config_map: {0}".format(str(e)))
            sys.exit(1)


def get_storage_config(storage_config_name, namespace):
    config.load_kube_config()
    api_instance = client.CoreV1Api()

    try:
        api_response = api_instance.read_namespaced_config_map(storage_config_name, namespace)

    except ApiException as e:
        if e.status == 404:
            logger.info("Couldn't find configmap named {0}.".format(storage_config_name))
            return None
        else:
            logger.error("Exception when calling CoreV1Api->read_namespaced_config_map: {0}".format(str(e)))
            sys.exit(1)

    return api_response.data

