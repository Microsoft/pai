# Copyright (c) Microsoft Corporation
# All rights reserved.
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
# documentation files (the "Software"), to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
# to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
# BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
# DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import http
import logging
import os
import sys

import requests

import teamwise_storage.storage_utils as storage_utils

#pylint: disable=wrong-import-position
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from plugin_utils import plugin_init, inject_commands
#pylint: enable=wrong-import-position

logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(filename)s:%(lineno)s - %(message)s",
    level=logging.INFO,
)
LOGGER = logging.getLogger(__name__)

REST_API_PREFIX = os.environ.get("PAI_REST_SERVER_URI")
USER_TOKEN = os.environ.get("PAI_USER_TOKEN")
USER_NAME = os.environ.get("PAI_USER_NAME")
JOB_NAME = os.environ.get("PAI_JOB_NAME")

STORAGE_PRE_COMMAND = ["apt-get update", "umask 000"]


def http_get(url) -> requests.Response:
    LOGGER.info("Send get request with url %s", url)
    return requests.get(url, headers={'Authorization': USER_TOKEN})


def generate_commands(storage_config_names) -> list:
    query_string = "&".join(
        list(map("names={}".format, storage_config_names)))
    resp = http_get(
        "{}/api/v2/storage/config/?{}".format(REST_API_PREFIX, query_string))
    if resp.status_code != http.HTTPStatus.OK:
        LOGGER.error(
            "Failed to get storage config from rest-server %s", resp.text)
        raise Exception("Generate commands faield")

    storage_configs = resp.json()
    servers_name = set([
        mount_info["server"] for storage_config in storage_configs for mount_info in storage_config["mountInfos"]])

    query_string = "&".join(
        list(map("names={}".format, servers_name)))
    resp = http_get(
        "{}/api/v2/storage/server/?{}".format(REST_API_PREFIX, query_string))
    if resp.status_code != http.HTTPStatus.OK:
        LOGGER.error(
            "Failed to get storage servers config from rest-server %s", resp.text)
        raise Exception("Generate commands faield")
    servers_configs = resp.json()

    return generate_storage_command(storage_configs, servers_configs)


def generate_storage_command(storage_configs, servers_configs) -> list:
    mount_commands = []
    mount_points = []
    server_mount_dict = storage_utils.perpare_server_mount_dict(storage_configs)

    for spn in server_mount_dict:
        mount_infos = server_mount_dict[spn]
        server_config = next(
            (conf for conf in servers_configs if conf["spn"] == spn), None)
        if not server_config:
            LOGGER.error("Failed to get server config: %s", spn)
            raise Exception("Generate mount command failed")

        storage_utils.validate_mount_point(mount_points, mount_infos)

        # 1. generate prepare command for storage
        tmp_folder = "/tmp_{}_root".format(spn)
        premount_commands = storage_utils.get_setup_command(
            server_config, tmp_folder, phrase="pre_mount", user_name=USER_NAME, job_name=JOB_NAME)

        # 2. mount root folder and make sub directories
        first_round_mount_commands = storage_utils.get_setup_command(
            server_config, tmp_folder, phrase="tmp_mount", user_name=USER_NAME, job_name=JOB_NAME)
        mkdir_commands = storage_utils.generate_make_tmp_folder_command(
            tmp_folder, mount_infos, USER_NAME, JOB_NAME)

        # 3. clean 1st round mount
        post_mount_commands = storage_utils.get_setup_command(
            server_config, tmp_folder, phrase="post_mount", user_name=USER_NAME, job_name=JOB_NAME)


        # 4. generate real mount command
        second_round_mount_commands = list(map(
            lambda mount_info,
                   config=server_config:
            storage_utils.get_setup_command(config,
                                            mount_info["mountPoint"],
                                            phrase="real_mount",
                                            relative_path=mount_info["path"],
                                            user_name=USER_NAME,
                                            job_name=JOB_NAME),
            mount_infos))
        second_round_mount_commands = [
            command for mount_command in second_round_mount_commands for command in mount_command]

        # 5 assemble all commands
        mount_commands.extend(premount_commands + first_round_mount_commands +
                              mkdir_commands + post_mount_commands + second_round_mount_commands)

    return mount_commands


def init_storage_plugin(parameters) -> None:
    resp = http_get("{}/api/v2/user/{}".format(REST_API_PREFIX, USER_NAME))
    if resp.status_code != http.HTTPStatus.OK:
        LOGGER.error("Failed to get user config, resp: %s", resp.text)
        sys.exit(1)

    user_config = resp.json()
    if not user_config["storageConfig"]:
        LOGGER.error(
            "User %s don't has the permission to access storage", USER_NAME)
        sys.exit(1)

    user_storage_config = user_config["storageConfig"]
    if parameters is None or parameters["storageConfigNames"] is None:
        # try to mount default storage
        sys.exit(0)

    storage_config_names = parameters["storageConfigNames"]
    if not storage_utils.is_valid_storage_config(user_storage_config, storage_config_names):
        LOGGER.error("User %s do not has permission to access storages: %s",
                     USER_NAME, storage_config_names)
        sys.exit(1)

    storage_config_names = parameters["storageConfigNames"]
    storage_commands = generate_commands(storage_config_names)
    seperator = "\n"
    return seperator.join(STORAGE_PRE_COMMAND + storage_commands)


def main():
    LOGGER.info("Preparing storage runtime plugin commands")
    [parameters, pre_script, _] = plugin_init()
    parameters = {"storageConfigNames": ["STORAGE_BJ"]}
    pre_script_commands = init_storage_plugin(parameters)
    inject_commands(pre_script_commands, pre_script)
    LOGGER.info("Storage runtime plugin perpared")


if __name__ == "__main__":
    main()
