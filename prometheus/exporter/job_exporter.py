#!/usr/bin/python
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

import subprocess
import threading
import copy
import json
import sys
import time
import logging
from logging.handlers import RotatingFileHandler
import datetime
from Queue import Queue
from Queue import Empty

import docker_stats
import docker_inspect
import gpu_exporter
import utils
from utils import Metric

logger = logging.getLogger(__name__)

def parse_from_labels(labels):
    gpuIds = []
    otherLabels = []

    for key, val in labels.items():
        logger.info(label)
        if "container_label_GPU_ID" == key:
            s2 = val.replace("\"", "").split(",")
            for id in s2:
                if id:
                    gpuIds.append(id)
        else:
            otherLabels[key] = val


    return gpuIds, otherLabels


def collect_job_metrics(gpuInfos):
    stats = docker_stats.stats()
    if stats is None:
        logger.warning("docker stats returns None")
        return None

    result = []
    for container in stats:
        inspectInfo = docker_inspect.inspect(container)
        if inspectInfo is None or not inspectInfo["labels"]:
            continue

        gpuIds, otherLabels = parse_from_labels(inspectInfo["labels"])
        otherLabels.update(inspectInfo["env"])

        for id in gpuIds:
            if gpuInfos:
                logger.info(gpuInfos)
                labels = copy.deepcopy(otherLabels)
                labels["minor_number"] = id

                result.append(Metric("container_GPUPerc", labels, gpuInfos[id]["gpuUtil"]))
                result.append(Metric("container_GPUMemPerc", labels, gpuInfos[id]["gpuMemUtil"]))

        result.append(Metric("container_CPUPerc", otherLabels, stats[container]["CPUPerc"]))
        result.append(Metric("container_MemUsage", otherLabels, stats[container]["MemUsage_Limit"]["usage"]))
        result.append(Metric("container_MemLimit", otherLabels, stats[container]["MemUsage_Limit"]["limit"]))
        result.append(Metric("container_NetIn", otherLabels, stats[container]["NetIO"]["in"]))
        result.append(Metric("container_NetOut", otherLabels, stats[container]["NetIO"]["out"]))
        result.append(Metric("container_BlockIn", otherLabels, stats[container]["BlockIO"]["in"]))
        result.append(Metric("container_BlockOut", otherLabels, stats[container]["BlockIO"]["out"]))
        result.append(Metric("container_MemPerc", otherLabels, stats[container]["MemPerc"]))

    return result

class Singleton(object):
    """ wrapper around gpu metrics getter, because getter may block
        indefinitely, so we wrap call in thread.
        Also, to avoid having too much threads, use semaphore to ensure only 1
        thread is running """
    def __init__(self, getter, get_timeout_s=3, old_data_timeout_s=60):
        self.getter = getter
        self.get_timeout_s = get_timeout_s
        self.old_data_timeout_s = datetime.timedelta(seconds=old_data_timeout_s)

        self.semaphore = threading.Semaphore(1)
        self.queue = Queue(1)
        self.old_metrics = None
        self.old_metrics_time = datetime.datetime.now()

    def try_get(self):
        if self.semaphore.acquire(False):
            def wrapper(semaphore, queue):
                """ wrapper assume semaphore already acquired, will release semaphore on exit """
                result = None

                try:
                    try:
                        # remove result put by previous thread but didn't get by main thread
                        queue.get(block=False)
                    except Empty:
                        pass

                    start = datetime.datetime.now()
                    result = self.getter()
                except Exception as e:
                    logger.warn("get gpu metrics failed")
                    logger.exception(e)
                finally:
                    logger.info("get gpu metrics spent %s", datetime.datetime.now() - start)
                    semaphore.release()
                    queue.put(result)

            t = threading.Thread(target=wrapper, name="gpu-metrices-getter",
                    args=(self.semaphore, self.queue))
            t.start()
        else:
            logger.warn("gpu-metrics-getter is still running")

        try:
            self.old_metrics = self.queue.get(block=True, timeout=self.get_timeout_s)
            self.old_metrics_time = datetime.datetime.now()
            return self.old_metrics
        except Empty:
            pass

        now = datetime.datetime.now()
        if now - self.old_metrics_time < self.old_data_timeout_s:
            return self.old_metrics

        logger.info("gpu info is too old")
        return None

def main(argv):
    logDir = argv[0]
    gpuMetricsPath = logDir + "/gpu_exporter.prom"
    jobMetricsPath = logDir + "/job_exporter.prom"

    timeSleep = int(argv[1])
    iter = 0

    singleton = Singleton(gpu_exporter.collect_gpu_info)

    while True:
        try:
            logger.info("job exporter running {0} iteration".format(str(iter)))
            iter += 1
            gpuInfos = singleton.try_get()

            gpuMetrics = gpu_exporter.convert_gpu_info_to_metrics(gpuInfos)
            if gpuMetrics is not None:
                utils.export_metrics_to_file(gpuMetricsPath, gpuMetrics)

            # join with docker stats metrics and docker inspect labels
            jobMetrics = collect_job_metrics(gpuInfos)
            utils.export_metrics_to_file(jobMetricsPath, jobMetrics)
        except Exception as e:
            logger.exception("exception in job exporter loop")

        time.sleep(timeSleep)


if __name__ == "__main__":
    rootLogger = logging.getLogger()
    rootLogger.setLevel(logging.INFO)
    fh = RotatingFileHandler("/datastorage/prometheus/gpu_exporter.log", maxBytes= 1024 * 1024 * 10, backupCount=5)
    fh.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(filename)s:%(lineno)s - %(message)s")
    fh.setFormatter(formatter)
    rootLogger.addHandler(fh)

    main(sys.argv[1:])
