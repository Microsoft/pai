# Installation Guide

The architecture of OpenPAI has been updated and optimized in `v1.0.0`. Before `v1.0.0`, OpenPAI was based on Yarn and Kubernetes, and data was managed by HDFS. Since `v1.0.0`, OpenPAI has switched to a pure Kubernetes-based architecture. Many new features, such as `AAD authorization`, `Hivedscheduler`, `Kube Runtime`, `Marketplace`, etc., are also included. If you still want to install the old Yarn-based OpenPAI, please stay with `v0.14.0`.

To install OpenPAI >= `v1.0.0`, please first check [Installation Requirements](#installation-requirements). Then, if you don't have older version OpenPAI installed, please follow the steps in this document directly. Otherwise, please first [uninstall OpenPAI < `v1.0.0`](./how-to-uninstall-openpai.md#lt100-uninstallation), then follow this document.

## Installation Requirements

The deployment of OpenPAI requires you to have **at least 3 separate machines**: one dev box machine, one master machine, and one worker machine.

Dev box machine controls masters and workers through SSH during installation, maintenance, and uninstallation. There should be one, and only one dev box.

The master machine is used to run core Kubernetes components and core OpenPAI services. Currently, OpenPAI does not support high availability and you can only specify one master machine.

We recommend you to use CPU-only machines for dev box and master. The detailed requirements for dev box machine and master machine are as follows:

<table>
<thead>
  <tr>
    <th></th>
    <th>Hardware Requirements</th>
    <th>Software Requirements</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>Dev Box Machine</td>
    <td>
      <ul>
        <li>It can communicate with all other machines (master and worker machines).</li>
        <li>It is separate from the cluster which contains the master machine and worker machines.</li>
        <li>It can access the internet, especially needs to have access to the docker hub registry service or its mirror. Deployment process will pull Docker images.</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Ubuntu 16.04 (18.04, 20.04 should work, but not fully tested)</li>
        <li>SSH service is enabled.</li>
        <li>Passwordless ssh to all other machines (master and worker machines).</li>
        <li>Docker is installed.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>Master Machine</td>
    <td>
      <ul>
        <li>At least 40GB of free memory.</li>
        <li>It has a <b>static LAN IP address</b>, and make sure it can communicate with all other machines.</li>
        <li>It can access the internet, especially needs to have access to the docker hub registry service or its mirror. Deployment process will pull Docker images.</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Ubuntu 16.04 (18.04, 20.04 should work, but not fully tested)</li>
        <li>SSH service is enabled. </li>
        <li>It shares the same username/password with worker machines, and have sudo privilege.</li>
        <li>Docker is installed.</li>
        <li>NTP service is enabled. You can use <code>apt install ntp</code> to check it.</li>
        <li>It is a dedicated server for OpenPAI. OpenPAI manages its all resources, including CPU, memory, GPU (or other computing devices). If there is any other workload, it may cause unknown problem due to insufficient resource.</li>
      </ul>
    </td>
  </tr>
</tbody>
</table>

The worker machines are used to run jobs. You can use multiple workers during installation.

We support various types of workers: CPU workers, GPU workers, and workers with other computing devices (e.g. TPU, NPU).

At the same time, we also support two schedulers: the Kubernetes default scheduler, and [hivedscheduler](https://github.com/microsoft/hivedscheduler).

Hivedscheduler is the default for OpenPAI. It supports virtual cluster division, topology-aware resource guarantee, and optimized gang scheduling, which are not supported in the k8s default scheduler.


For now, the support for CPU/NVIDIA GPU workers and workers with other computing device is different:

  - For CPU workers and NVIDIA GPU workers, both k8s default scheduler and hived scheduler can be used.
  - For workers with other types of computing devices (e.g. TPU, NPU), currently, we only support the usage of the k8s default scheduler. You can only include workers with the same computing device in the cluster. For example, you can use TPU workers, but all workers should be TPU workers. You cannot use TPU workers together with GPU workers in one cluster.

Please check the following requirements for different types of worker machines:

<table>
<thead>
  <tr>
    <th>Worker Type</th>
    <th>Hardware Requirements</th>
    <th>Software Requirements</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>CPU Worker</td>
    <td>
      <ul>
        <li>At least 16GB of free memory.</li>
        <li>It has a <b>static LAN IP address</b>, and make sure it can communicate with all other machines.</li>
        <li>It can access the internet, especially needs to have access to the docker hub registry service or its mirror. Deployment process will pull Docker images.</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Ubuntu 16.04 (18.04, 20.04 should work, but not fully tested)</li>
        <li>SSH service is enabled. </li>
        <li>It shares the same username/password with all other machines, and have sudo privilege.</li>
        <li>Docker is installed.</li>
        <li>It is a dedicated server for OpenPAI. OpenPAI manages its all resources, including CPU, memory, GPU (or other computing devices). If there is any other workload, it may cause unknown problem due to insufficient resource.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>NVIDIA GPU Worker</td>
    <td>The same as above.</td>
    <td>
      The same as <code>CPU worker</code>, and with the following additional requirements:
      <ul>
        <li><b>NVIDIA GPU Driver is installed.</b> You may use <a href="./installation-faqs-and-troubleshooting.html#how-to-check-whether-the-gpu-driver-is-installed">a command</a> to check it. Refer to <a href="./installation-faqs-and-troubleshooting.html#how-to-install-gpu-driver">the installation guidance</a> in FAQs if the driver is not successfully installed. If you are wondering which version of GPU driver you should use, please also refer to <a href="./installation-faqs-and-troubleshooting.html#which-version-of-nvidia-driver-should-i-install">FAQs</a>.</li>
        <li><b><a href="https://github.com/NVIDIA/nvidia-container-runtime">nvidia-container-runtime</a> is installed. And be configured as the default runtime of docker.</b> Please configure it in <a href="https://docs.docker.com/config/daemon/#configure-the-docker-daemon">docker-config-file (daemon.json)</a>, instead of in the systemd's config. You can use command <code>sudo docker run --rm nvidia/cuda:10.0-base nvidia-smi</code> to check it. This command should output information of available GPUs if it is setup properly. Refer to <a href="./installation-faqs-and-troubleshooting.html#how-to-install-nvidia-container-runtime">the installation guidance</a> if it is not successfully set up. We don't recommend to use <code>nvidia-docker2</code>. For a detailed comparison between <code>nvidia-container-runtime</code> and <code>nvidia-docker2</code>, please refer to <a href="https://github.com/NVIDIA/nvidia-docker/issues/1268#issuecomment-632692949">here</a>. </li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>Enflame DTU Worker</td>
    <td>The same as above.</td>
    <td>
      The same as <code>CPU worker</code>, and with the following additional requirements:
      <ul>
        <li>Enflame DTU Driver is installed.</li>
        <li>Enflame container runtime is installed. And be configured as the default runtime of docker. Please configure it in <a href="https://docs.docker.com/config/daemon/#configure-the-docker-daemon">docker-config-file</a>, because systemd's env will be overwritten during installation.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>Other Computing Device</td>
    <td>The same as above.</td>
    <td>
      The same as <code>CPU worker</code>, and with the following additional requirements:
      <ul>
        <li>The driver of the device is installed.</li>
        <li>The container runtime of the device is installed. And be configured as the default runtime of docker. Please configure it in <a href="https://docs.docker.com/config/daemon/#configure-the-docker-daemon">docker-config-file</a>, because systemd's env will be overwritten during installation.</li>
        <li>You should have a deployable <a href="https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/">device plugin</a> of the computing device. After the Kubernetes is set up, you should manually deploy it in cluster. </li>
      </ul>
    </td>
  </tr>
</tbody>
</table>

After you have checked the requirements, please follow these 3 steps to install OpenPAI:

* Prepare configuration files for both Kubernetes and OpenPAI
* Start Kubernetes
* Start OpenPAI services

## Prepare Configuration Files

On the dev box machine, use the following commands to clone the OpenPAI repo:

```bash
git clone https://github.com/microsoft/pai.git
cd pai
```

Choose a version to install by checkout to a specific tag:

```bash
git checkout v1.8.0
```

Please edit `layout.yaml` and a `config.yaml` file under `<pai-code-dir>/contrib/kubespray/config` folder.
These two files specify the cluster layout and the customized configuration, respectively.
The following is the format and example of these 2 files.

**Tips for Chinese Users**: If you are in Mainland China, please refer to [here](./configuration-for-china.md) first before you edit these files.

#### `layout.yaml` format

``` yaml
# GPU cluster example
# This is a cluster with one master node and two worker nodes

machine-sku:
  master-machine: # define a machine sku
    # the resource requirements for all the machines of this sku
    # We use the same memory format as Kubernetes, e.g. Gi, Mi
    # Reference: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/#meaning-of-memory
    mem: 60Gi
    cpu:
      # the number of CPU vcores
      vcore: 24
  gpu-machine:
    computing-device:
      # For `type`, please follow the same format specified in the device plugin.
      # For example, `nvidia.com/gpu` is for NVIDIA GPU, `amd.com/gpu` is for AMD GPU,
      # and `enflame.com/dtu` is for Enflame DTU.
      # Reference: https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/
      type: nvidia.com/gpu
      model: K80
      count: 4
    mem: 220Gi
    cpu:
      vcore: 24

machine-list:
  - hostname: pai-master # name of the machine, **do not** use upper case alphabet letters for hostname
    hostip: 10.0.0.1
    machine-type: master-machine # only one master-machine supported
    pai-master: "true"
  - hostname: pai-worker1
    hostip: 10.0.0.2
    machine-type: gpu-machine
    pai-worker: "true"
  - hostname: pai-worker2
    hostip: 10.0.0.3
    machine-type: gpu-machine
    pai-worker: "true"
```

#### `config.yaml` example

``` yaml
user: forexample
password: forexample
docker_image_tag: v1.8.0

# Optional


#######################################################################
#                    OpenPAI Customized Settings                      #
#######################################################################
# enable_hived_scheduler: true
# enable_docker_cache: true
# docker_cache_storage_backend: "azure" # or "filesystem"
# docker_cache_azure_account_name: ""
# docker_cache_azure_account_key: ""
# docker_cache_azure_container_name: "dockerregistry"
# docker_cache_fs_mount_path: "/var/lib/registry"
# docker_cache_remote_url: "https://registry-1.docker.io"
# docker_cache_htpasswd: ""
# enable_marketplace: "true"

#############################################
# Ansible-playbooks' inventory hosts' vars. #
#############################################
# ssh_key_file_path: /path/to/you/key/file

#####################################
# OpenPAI's service image registry. #
#####################################
# docker_registry_domain: docker.io
# docker_registry_namespace: openpai
# docker_registry_username: exampleuser
# docker_registry_password: examplepasswd

################################################################
# OpenPAI's daemon qos config.                                 #
# By default, the QoS class for PAI daemon is BestEffort.      #
# If you want to promote QoS class to Burstable or Guaranteed, #
# you should set the value to true.                            #
################################################################
# qos-switch: "false"

###########################################################################################
#                         Pre-check setting                                               #
###########################################################################################
# docker_check: true
# resource_check: true

########################################################################################
# Advanced docker configuration. If you are not familiar with them, don't change them. #
########################################################################################
# docker_data_root: /mnt/docker
# docker_config_file_path: /etc/docker/daemon.json
# docker_iptables_enabled: false

## An obvious use case is allowing insecure-registry access to self hosted registries.
## Can be ipaddress and domain_name.
## example define 172.19.16.11 or mirror.registry.io
# openpai_docker_insecure_registries:
#   - mirror.registry.io
#   - 172.19.16.11

## Add other registry,example China registry mirror.
# openpai_docker_registry_mirrors:
#   - https://registry.docker-cn.com
#   - https://mirror.aliyuncs.com

#######################################################################
#                       kubespray setting                             #
#######################################################################

# If you couldn't access to gcr.io or docker.io, please configure it.
# gcr_image_repo: "gcr.io"
# kube_image_repo: "gcr.io/google-containers"
# quay_image_repo: "quay.io"
# docker_image_repo: "docker.io"
# etcd_image_repo: "quay.io/coreos/etcd"
# pod_infra_image_repo: "gcr.io/google_containers/pause-{{ image_arch }}"
# kubeadm_download_url: "https://storage.googleapis.com/kubernetes-release/release/{{ kubeadm_version }}/bin/linux/{{ image_arch }}/kubeadm"
# hyperkube_download_url: "https://storage.googleapis.com/kubernetes-release/release/{{ kube_version }}/bin/linux/{{ image_arch }}/hyperkube"

# openpai_kube_network_plugin: calico

# openpai_kubespray_extra_var:
#   key: value
#   key: value

#######################################################################
#                     host daemon port setting                        #
#######################################################################
# host_daemon_port_start: 40000
# host_daemon_port_end: 65535
```

The `user` and `password` is the SSH username and password from dev box machine to master machines and worker machines, you should make sure all masters and workers share the same SSH username and password. As for optional configurations, customize them if you know exactly what they are.

**For Azure Users**: If you are deploying OpenPAI in Azure, please uncomment `openpai_kube_network_plugin: calico` in the config file above, and change it to `openpai_kube_network_plugin: weave`. It is because Azure doesn't support calico. See [here](https://docs.projectcalico.org/reference/public-cloud/azure#why-doesnt-azure-support-calico-networking) for details.

**For those who use workers other than CPU workers and NVIDIA GPU workers**: Now we only support Kubernetes default scheduler (not Hivedscheduler) for devices other than NVIDIA GPU and CPU. Please uncomment `# enable_hived_scheduler: true` and set it to `enable_hived_scheduler: false`.

**If qos-switch is enabled**: OpenPAI daemons will request additional resources in each node. Please check the following table and reserve sufficient resources for OpenPAI daemons.

| Service Name  | Memory Request | CPU Request |
| :-----------: | :------------: | :---------: |
| node-exporter |     128Mi      |      0      |
| job-exporter  |     512Mi      |      0      |
|  log-manager  |     256Mi      |      0      |

## Start Kubernetes

Go to folder `<pai-code-dir>/contrib/kubespray`:

``` bash
cd <pai-code-dir>/contrib/kubespray
```

The folder `pai/contrib/kubespray` contains installation scripts, both for Kubernetes and OpenPAI services.
Please run the following script to deploy Kubernetes first. As the name explains, we adopt [kubespray](https://github.com/kubernetes-sigs/kubespray) to install Kubernetes.

``` bash
/bin/bash quick-start-kubespray.sh
```

By default, ansible logs of `skip` and `ok` hosts are not displayed. To view more complete ansible logs, run the script in `verbose` mode:

``` bash
/bin/bash quick-start-kubespray.sh -v
```

If there is any problem, please double-check the environment requirements first. Here we provide a requirement checker to help you verify:

``` bash
/bin/bash requirement.sh -l config/layout.yaml -c config/config.yaml
```

You can also refer to [the installation troubleshooting](./installation-faqs-and-troubleshooting.md#troubleshooting) or search engine for solution. After you fix the problem, re-run `/bin/bash quick-start-kubespray.sh`.

The `quick-start-kubespray.sh` will output the following information if k8s is successfully installed:

```
You can run the following commands to set up kubectl on your localhost:
ansible-playbook -i ${HOME}/pai-deploy/kubespray/inventory/pai/hosts.yml set-kubectl.yml --ask-become-pass
```

By default, we don't set up `kubeconfig` or install `kubectl` client on the dev box machine, but we put the Kubernetes config file in `~/pai-deploy/kube/config`. You can use the config with any Kubernetes client to verify the installation.

Also, you can use the command `ansible-playbook -i ${HOME}/pai-deploy/kubespray/inventory/pai/hosts.yml set-kubectl.yml --ask-become-pass` to set up `kubeconfig` and `kubectl` on the dev box machine. It will copy the config to `~/.kube/config` and set up the `kubectl` client. After it is executed, you can use `kubectl` on the dev box machine directly.

#### Tips for Network-related Issues
If you are facing network issues such as the machine cannot download some file, or cannot connect to some docker registry, please combine the prompted error log and kubespray as a keyword, and search for a solution. You can also refer to the [installation troubleshooting](./installation-faqs-and-troubleshooting.md#troubleshooting) and [this issue](https://github.com/microsoft/pai/issues/4516).

## Start OpenPAI Services

After Kubernetes is successfully started, run the following script to start OpenPAI services.

``` bash
/bin/bash quick-start-service.sh
```

If everything goes well, you will get a message as follows:

``` bash
Kubernetes cluster config :     ~/pai-deploy/kube/config
OpenPAI cluster config    :     ~/pai-deploy/cluster-cfg
OpenPAI cluster ID        :     pai
Default username          :     admin
Default password          :     admin-password

You can go to http://<your-master-ip>, then use the default username and password to log in.
```

As the message says, you can use `admin` and `admin-password` to login to the webportal, then submit a job to validate your installation. We have generated the configuration files of OpenPAI in the folder `~/pai-deploy/cluster-cfg`. If you need further customization, they will be used in the future.

**For those who use workers other than CPU workers, NVIDIA GPU workers, AMD GPU workers, and Enflame DTU workers**: Please manually deploy the device's device plugin in Kubernetes. Otherwise, the Kubernetes default scheduler won't work. Supported device plugins are listed [in this file](https://github.com/microsoft/pai/blob/master/src/device-plugin/deploy/start.sh.template). PRs are welcome.

## Keep a Folder

We highly recommend you keep the folder `~/pai-deploy` for future operations such as upgrade, maintenance, and uninstallation. The most important contents in this folder are:

  + Kubernetes cluster config (the default is `~/pai-deploy/kube/config`): Kubernetes config file. It is used by `kubectl` to connect to the k8s API server.
  + OpenPAI cluster config (the default is  `~/pai-deploy/cluster-cfg`): It is a folder containing machine layout and OpenPAI service configurations.

If it is possible, you can make a backup of `~/pai-deploy` in case it is deleted unexpectedly.

Apart from the folder, you should remember your OpenPAI cluster-ID, which is used to indicate your OpenPAI cluster.
The default value is `pai`. Some management operation needs a confirmation of this cluster-ID.
