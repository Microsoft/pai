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

import logging
import os
import sys

sys.path.append(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
from plugins.plugin_utils import plugin_init, PluginHelper, request_rest_server, try_to_install_by_cache  #pylint: disable=wrong-import-position
import shlex
import json
import traceback

LOGGER = logging.getLogger(__name__)


def main():
    LOGGER.info("Preparing ssh runtime plugin commands")
    [plugin_config, pre_script, _] = plugin_init()
    plugin_helper = PluginHelper(plugin_config)
    parameters = plugin_config.get("parameters")

    if not parameters:
        LOGGER.info("Ssh plugin parameters is empty, ignore this")
        return

    gang_allocation = os.environ.get("GANG_ALLOCATION", "true")
    if gang_allocation == "false":
        LOGGER.warning("Job ssh is conflict with gang allocation, set job ssh to false")
        jobssh = "false"
    elif "jobssh" in parameters:
        jobssh = str(parameters["jobssh"]).lower()
    else:
        jobssh = "false"
    cmd_params = [jobssh]

    ssh_keys = []
    if "userssh" in parameters:
        if "type" in parameters["userssh"] and "value" in parameters["userssh"]:
            cmd_params.append(str(parameters["userssh"]["type"]))
            ssh_keys.append(parameters["userssh"]["value"])

    if "enable" in parameters and parameters["enable"] is True:
        try:
            USER_NAME = os.environ.get("PAI_USER_NAME")
            # system-level public key
            ssh_keys.append(
                json.loads(
                    request_rest_server("GET", "api/extend/user/{}/ssh-key/system".format(USER_NAME)).text
                )['public-key']
            )
            # user's custom public keys
            ssh_keys.extend([
                entry['public-key'] for _, entry in
                json.loads(
                    request_rest_server("GET", "api/extend/user/{}/ssh-key/custom".format(USER_NAME)).text
                ).items()
            ])
        except Exception:
            LOGGER.error(traceback.format_exc())
    cmd_params.append(shlex.quote('\\n'.join(ssh_keys)))

    # write call to real executable script
    command = []
    if len(cmd_params) == 1 and cmd_params[0] == "false":
        LOGGER.info("Skip sshd script since neither jobssh or userssh is set")
    else:
        command = [
            try_to_install_by_cache('ssh') + ' || { apt-get update; apt-get install -y openssh-client openssh-server; }',
            "{}/sshd.sh {}\n".format(os.path.dirname(os.path.abspath(__file__)),
                                     " ".join(cmd_params))
        ]

    # ssh barrier
    if jobssh == "true" and "sshbarrier" in parameters and str(
            parameters["sshbarrier"]).lower() == "true":
        if "sshbarriertaskroles" in parameters:
            barrier_params = " ".join(
                '"{}"'.format(tr) for tr in parameters["sshbarriertaskroles"])
        else:
            barrier_params = ""
        command.append("{}/sshbarrier.sh {}\n".format(
            os.path.dirname(os.path.abspath(__file__)), barrier_params))

    plugin_helper.inject_commands(command, pre_script)
    LOGGER.info("Ssh runtime plugin perpared")


if __name__ == "__main__":
    main()
