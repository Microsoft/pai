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
import collections
import logging
import argparse

import json

log = logging.getLogger(__name__)

def get_container_port(envs, name):
    for env in envs:
        if env["name"] == name:
            return env["value"]
    return None

def export(k, v):
    print "export %s='%s'" % (k, v)

def gen_static_env(framework):
    export("PAI_USER_NAME", framework["metadata"]["labels"]["userName"])
    export("PAI_JOB_NAME", "{}~{}".format(framework["metadata"]["labels"]["userName"], framework["metadata"]["labels"]["jobName"]))
    export("PAI_TASK_ROLE_COUNT", len(framework["spec"]["taskRoles"]))
    export("PAI_TASK_ROLE_LIST", ",".join(map(lambda x: x["name"], framework["spec"]["taskRoles"])))

    for idx, taskRole in enumerate(framework["spec"]["taskRoles"]):
        export("PAI_TASK_ROLE_TASK_COUNT_{}".format(taskRole["name"]), taskRole["taskNumber"])
        export("PAI_MIN_FAILED_INSTANCE_{}".format(taskRole["name"]), taskRole["frameworkAttemptCompletionPolicy"]["minFailedTaskCount"])
        export("PAI_MIN_SUCCEEDED_INSTANCE_{}".format(taskRole["name"]), taskRole["frameworkAttemptCompletionPolicy"]["minSucceededTaskCount"])

        if (taskRole["name"] == os.environ.get("FC_TASKROLE_NAME")):
            export("PAI_CURRENT_TASK_ROLE_NAME", taskRole["name"])
            export("PAI_CURRENT_TASK_ROLE_TASK_COUNT", taskRole["taskNumber"])
            resources = taskRole["task"]["pod"]["spec"]["containers"][0]["resources"]["limits"]
            export("PAI_CURRENT_TASK_ROLE_CPU_COUNT", resources["cpu"] or "")
            export("PAI_CURRENT_TASK_ROLE_MEM_MB", resources["memory"] or "")
            export("PAI_CURRENT_TASK_ROLE_MIN_FAILED_TASK_COUNT", taskRole["frameworkAttemptCompletionPolicy"]["minFailedTaskCount"])
            export("PAI_CURRENT_TASK_ROLE_MIN_SUCCEEDED_TASK_COUNT", taskRole["frameworkAttemptCompletionPolicy"]["minSucceededTaskCount"])


# generate runtime environment variables:
# PAI_CURRENT_TASK_ROLE_CURRENT_TASK_INDEX
# PAI_HOST_IP_$taskRole_$taskIndex

# These two variables are legacy, subject to removal
# PAI_TASK_ROLE_$name_HOST_LIST
# PAI_$taskRole_$currentTaskIndex_$type_PORT
def gen_runtime_env(framework):
    index_id = os.environ.get("FC_TASK_INDEX")

    if index_id is None:
        log.error("expect FC_TASK_INDEX set as environment variable")
    else:
        export("PAI_CURRENT_TASK_ROLE_CURRENT_TASK_INDEX", index_id)

    log.info("loading json from %s", args.framework_json)

    # key is role_name, value is its PAI_CURRENT_CONTAINER_PORT val
    role_cur_port_map = {}
    # key is role_name, value is its PAI_CONTAINER_HOST_PORT_LIST val
    role_ports_map = {}

    cur_task_role_name = os.environ.get("FC_TASKROLE_NAME")

    # key is role_name, value is task count in this role
    role_task_cnt = {}

    for idx, role in enumerate(framework["spec"]["taskRoles"]):
        role_name = role["name"]
        if role_name == cur_task_role_name:
            export("PAI_TASK_ROLE_INDEX", idx) # TODO legacy environment
        cur_port = get_container_port(
                role["task"]["pod"]["spec"]["containers"][0]["env"],
                "PAI_CURRENT_CONTAINER_PORT")
        ports = get_container_port(
                role["task"]["pod"]["spec"]["containers"][0]["env"],
                "PAI_CONTAINER_HOST_PORT_LIST")

        role_cur_port_map[role_name] = cur_port
        role_ports_map[role_name] = ports
        role_task_cnt[role_name] = role["taskNumber"]

    log.info("role_cur_port_map is %s, role_ports_map is %s",
            role_cur_port_map, role_ports_map)

    # key is role name, value is a map with key of index, value of ip
    role_status_map = collections.defaultdict(lambda : {})

    for role_status in framework["status"]["attemptStatus"]["taskRoleStatuses"]:
        name = role_status["name"]
        for status in role_status["taskStatuses"]:
            role_status_map[name][status["index"]] = status["attemptStatus"]["podIP"]

    log.info("role_status_map is %s", role_status_map)

    role_host_port_map = {}
    for role_name, status in role_status_map.items():
        port = role_cur_port_map[role_name]
        ip_ports = []
        for i in xrange(len(status)):
            ip_ports.append(status[i] + ":" + str(port))
        role_host_port_map[role_name] = ",".join(ip_ports)

    # generate
    for role_name, idx_map in role_status_map.items():
        for idx, ip in idx_map.items():
            export("PAI_HOST_IP_%s_%d" % (role_name, idx), ip)

    # following is legacy, subject to removal
    for role_name, host_port_list in role_host_port_map.items():
        export("PAI_TASK_ROLE_%s_HOST_LIST" % role_name, host_port_list)

    # for role_name, ports in role_ports_map.items():
    #     ports = ports.split(";")
    #     for label_port in ports:
    #         label, port = label_port.split(":")
    #         for i in xrange(role_task_cnt[role_name]):
    #             export("PAI_%s_%d_%s_PORT" % (role_name, i, label), port)

if __name__ == '__main__':
    logging.basicConfig(format="%(asctime)s - %(levelname)s - %(filename)s:%(lineno)s - %(message)s",
            level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("framework_json", help="framework.json path generated by frameworkbarrier")
    args = parser.parse_args()

    with open(args.framework_json) as f:
        framework = json.load(f)
    gen_static_env(framework)
    gen_runtime_env(framework)
