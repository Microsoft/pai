# 安装指南

OpenPAI的架构在`v1.0.0`时进行了更新和优化。在`v1.0.0`之前，OpenPAI基于Yarn和Kubernetes，数据由HDFS管理。从`v1.0.0`开始，OpenPAI转变为纯Kubernetes的架构。除此之外，`v1.0.0`还包括许多新特性，如`AAD 认证`、`Hived调度器`、`Kube Runtime`、`Marketplace`等。如果您仍要安装旧的基于Yarn的OpenPAI，请使用`v0.14.0`。

要安装 OpenPAI >= `v1.0.0`, 请先检查[安装要求](#installation-requirements)。 接下来, 如果您之前没有安装过老版本的OpenPAI，请直接跟随本文档中的步骤进行安装。如果您之前安装过OpenPAI，请先[清除已有安装](./how-to-uninstall-openpai.md#lt100-uninstallation), 再跟随本文档。

## <div id="installation-requirements">安装要求</div>

OpenPAI的部署要求您至少有3台独立的机器：一台dev box机器、一台master机器和一台worker机器。

dev box机器在安装、维护和卸载期间，通过SSH控制master机器和worker机器。您应该指定唯一一台dev box机器。

master机器用于运行核心Kubernetes组件和核心OpenPAI服务。目前，OpenPAI还不支持 HA (high availability), 您只能指定唯一一台master机器。

我们建议您使用纯CPU机器作为dev box机器和master机器。详细的要求请参考下面的表格：

<table>
<thead>
  <tr>
    <th></th>
    <th>硬件要求</th>
    <th>软件要求</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>dev box 机器</td>
    <td>
      <ul>
        <li>它可以与所有其他机器（master和worker机器）通信。</li>
        <li>它是独立于master机器和worker机器之外的一台机器。</li>
        <li>它可以访问Internet。尤其是可以访问Docker Hub。部署过程会从Docker Hub拉取Docker镜像。</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Ubuntu 16.04 (18.04、20.04应该可用，但没有经过完整测试)</li>
        <li>SSH服务已开启。</li>
        <li>可以免密登录所有master和worker机器。</li>
        <li>Docker已被正确安装。</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>master 机器</td>
    <td>
      <ul>
        <li>至少40GB内存。</li>
        <li>必须有<b>固定的局域网 IP 地址（LAN IP address）</b>，且可以和其他所有机器通信。</li>
        <li>可以访问Internet。尤其是可以访问Docker Hub。部署过程会从Docker Hub拉取Docker镜像。</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Ubuntu 16.04 (18.04、20.04应该可用，但没有经过完整测试)</li>
        <li>SSH服务已开启。</li>
        <li>和所有worker机器有同样的SSH用户名和密码，且该SSH用户有sudo权限。</li>
        <li>Docker已被正确安装。</li>
        <li>NTP已被成功开启。 您可以用命令<code>apt install ntp</code>来检查。</li>
        <li>它是OpenPAI的专用服务器。OpenPAI管理它的所有资源（如CPU、内存、GPU等）。如果有其他工作负载，则可能由于资源不足而导致未知问题。</li>
      </ul>
    </td>
  </tr>
</tbody>
</table>

worker机器会被用来执行任务，您可以在安装期间指定一台或多台worker机器。

我们支持不同种类的worker：CPU机器、GPU机器、以及拥有其他计算设备（如TPU、NPU）的机器。

同时，我们还有两种调度器：Kubernetes default scheduler和[hivedscheduler](https://github.com/microsoft/hivedscheduler)。

hivedscheduler是OpenPAI的默认调度器，它支持虚拟集群划分，拓扑感知的资源保证、以及性能优化的 Gang Scheduling，这些都是 k8s default scheduler 不支持的。

目前，对 CPU/NVIDIA GPU worker 和其他种类 worker，调度器的支持有所不同：

  - 对于CPU worker或NVIDIA GPU worker，可以使用k8s default scheduler或hivedscheduler。
  - 对于其他种类的worker，例如TPU、NPU机器，我们目前只支持使用k8s default scheduler。同时，您在集群中只能使用同一种计算设备的机器。例如，您可以在集群中使用TPU worker，但所有worker必须都是TPU worker，不能把TPU worker和其他GPU worker在同一集群中混用。

不同种类worker机器的详细要求请参考以下表格：


<table>
<thead>
  <tr>
    <th>worker 种类</th>
    <th>硬件要求</th>
    <th>软件要求</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>CPU Worker</td>
    <td>
      <ul>
        <li>至少16GB内存。</li>
        <li>必须有<b>固定的局域网 IP 地址（LAN IP address）</b>，且可以和其他所有机器通信。</li>
        <li>可以访问Internet。尤其是可以访问Docker Hub。部署过程会从Docker Hub拉取Docker镜像。</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Ubuntu 16.04 (18.04、20.04应该可用，但没有经过完整测试)</li>
        <li>SSH服务已开启。 </li>
        <li>所有master和worker机器有同样的SSH用户名和密码，且该SSH用户有sudo权限。</li>
        <li>Docker已被正确安装。</li>
        <li>它是OpenPAI的专用服务器。OpenPAI管理它的所有资源（如CPU、内存、GPU等）。如果有其他工作负载，则可能由于资源不足而导致未知问题。</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>NVIDIA GPU Worker</td>
    <td>同上。</td>
    <td>
      需要满足和<code>CPU worker</code>一样的要求，除此之外还有下面的额外要求：
      <ul>
        <li><b>GPU驱动已被正确安装。</b> 您可以用<a href="./installation-faqs-and-troubleshooting.html#how-to-check-whether-the-gpu-driver-is-installed">这个命令</a>来检查。 如果您的GPU驱动未被正确安装，可以参考<a href="./installation-faqs-and-troubleshooting.html#how-to-install-gpu-driver">如何安装GPU驱动</a>。如果您对安装哪个版本的GPU驱动有疑问，可以阅读<a href="./installation-faqs-and-troubleshooting.html#which-version-of-nvidia-driver-should-i-install">这个文档</a>。</li>
        <li><b><a href="https://github.com/NVIDIA/nvidia-container-runtime">nvidia-container-runtime</a>已被正确安装，并且被设置为Docker的默认runtime。</b> 因为systemd的配置会在接下来安装过程中被覆盖，所以请不要在systemd里设置 docker 默认runtime，而是在<a href="https://docs.docker.com/config/daemon/#configure-the-docker-daemon">docker-config-file (daemon.json)</a>里进行设置。 您可以使用命令<code>sudo docker run --rm nvidia/cuda:10.0-base nvidia-smi</code> 来检查这一项。如果该命令成功打出当前可用的显卡个数，就说明设置是没问题的。如果它未被正确安装，请参考<a href="./installation-faqs-and-troubleshooting.html#how-to-install-nvidia-container-runtime">如何安装nvidia container runtime</a>。 我们不推荐您使用<code>nvidia-docker2</code>。 有关 <code>nvidia-container-runtime</code> 和 <code>nvidia-docker2</code> 的详细对比，请参考<a href="https://github.com/NVIDIA/nvidia-docker/issues/1268#issuecomment-632692949">这里</a>。</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>Enflame DTU Worker</td>
    <td>同上。</td>
    <td>
      需要满足和<code>CPU worker</code>一样的要求，除此之外还有下面的额外要求：
      <ul>
        <li>Enflame DTU 驱动已被正确安装。</li>
        <li>Enflame container runtime 已被正确安装，并且被设置为Docker的默认runtime。因为systemd的配置会在接下来安装过程中被覆盖，所以请不要在systemd里设置 docker 默认runtime，而是在<a href="https://docs.docker.com/config/daemon/#configure-the-docker-daemon">docker-config-file</a>里进行设置。</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>其他计算设备</td>
    <td>同上。</td>
    <td>
      需要满足和<code>CPU worker</code>一样的要求，除此之外还有下面的额外要求：
      <ul>
        <li>设备的驱动已被正确安装</li>
        <li>设备的 container runtime 已被正确安装，并且被设置为Docker的默认runtime。因为systemd的配置会在接下来安装过程中被覆盖，所以请不要在systemd里设置 docker 默认runtime，而是在<a href="https://docs.docker.com/config/daemon/#configure-the-docker-daemon">docker-config-file</a>里进行设置。</li>
        <li>您需要用一个该设备的<a href="https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/">device plugin</a>。在Kubernetes安装后，您需要手动将该device plugin部署在集群中。</li>
      </ul>
    </td>
  </tr>
</tbody>
</table>

检查完要求后，请按照下面的3个步骤安装OpenPAI：

* 为Kubernetes和OpenPAI创建设置文件
* 安装Kubernetes
* 安装OpenPAI服务

## <div id="create-configurations">创建设置文件</div>

在dev box机器上，使用下面的命令来克隆OpenPAI的repo：

```bash
git clone https://github.com/microsoft/pai.git
cd pai
```

checkout到某一个tag，来选择需要安装的OpenPAI版本：

```bash
git checkout v1.8.0
```

接下来，请编辑`<pai-code-dir>/contrib/kubespray/config`目录下的`layout.yaml`和`config.yaml`文件。
这两个文件分别指定了集群的机器组成和自定义设置。下面是示例：

#### 关于中国用户的提示

如果您是中国用户，在编辑这两个文件前，请先阅读[这个文档](./configuration-for-china.md)。

#### <div id="layoutyaml-format">`layout.yaml` 格式示例</div>

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
      # For `type`, please follow the same format specified in device plugin.
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

#### <div id="configyaml-example">`config.yaml` 格式示例</div>

``` yaml
user: forexample
password: forexample
docker_image_tag: v1.8.0

# Optional

#######################################################################
#                    OpenPAI Customized Settings                      #
#######################################################################
# enable_hived_scheduler: true

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

`user`和`password`是master机器、worker机器共享的SSH用户名和密码。换句话说，您得确保所有master机器和worker机器有同样的SSH用户名和密码。 其他的配置为可选配置，只有当您清楚地知道它们的含义时，您可以去修改它，否则请不要修改。

**Azure用户请注意**： 如果您在Azure上部署OpenPAI，请去掉`openpai_kube_network_plugin: calico`的注释，并把它修改为`openpai_kube_network_plugin: weave`. 这是因为Azure暂时不支持calico。细节部分请参阅[这个文档](https://docs.projectcalico.org/reference/public-cloud/azure#why-doesnt-azure-support-calico-networking)。

**如果您使用了除了CPU worker和NVIDIA GPU worker之外的worker结点**：对于CPU worker和NVIDIA GPU worker之外的worker种类，目前我们只支持Kubernetes default scheduler (而不是Hivedscheduler)。请去掉`# enable_hived_scheduler: true`的注释，并且将它设置为`enable_hived_scheduler: false`。

**如果您在config中开启了qos-switch**： 此时，OpenPAI会在每个worker机器上要求额外的内存。请参考下面的表格，确保您的worker机器上有足够的内存：

| Service Name  | Memory Request | CPU Request |
| :-----------: | :------------: | :---------: |
| node-exporter |     128Mi      |      0      |
| job-exporter  |     512Mi      |      0      |
|  log-manager  |     256Mi      |      0      |

## 安装Kubernetes

转到目录`<pai-code-dir>/contrib/kubespray`：

``` bash
cd <pai-code-dir>/contrib/kubespray
```

目录`<pai-code-dir>/contrib/kubespray`中包含了Kubernetes和OpenPAI服务的代码。
请先运行下面的命令安装Kubernetes。 顾名思义，我们使用[kubespray](https://github.com/kubernetes-sigs/kubespray)来安装Kubernetes。

``` bash
/bin/bash quick-start-kubespray.sh
```

安装过程中默认不显示`skip`和`ok`类型的ansible log。如需查看更完全的ansible log，请使用`verbose`模式：

``` bash
/bin/bash quick-start-kubespray.sh -v
```

如果在安装过程中出现任何问题，请再次检查上述环境要求。我们也提供了一个脚本，帮助您进行检查：

``` bash
/bin/bash requirement.sh -l config/layout.yaml -c config/config.yaml
```

同时，您也可以参考[安装故障排查文档](./installation-faqs-and-troubleshooting.md#troubleshooting)或直接在搜索引擎上查找解决方法。当您解决问题后，请重新运行`/bin/bash quick-start-kubespray.sh`。

如果安装成功，`quick-start-kubespray.sh` 会打印出下面的信息：

```
You can run the following commands to setup kubectl on you local host:
ansible-playbook -i ${HOME}/pai-deploy/kubespray/inventory/pai/hosts.yml set-kubectl.yml --ask-become-pass
```

在默认情况下，我们既不会在dev box机器上配置默认的`kubeconfig`，也不会安装`kubectl`客户端，只会把Kubernetes的config文件放在`~/pai-deploy/kube/config`。您可以在任何Kubernetes客户端上使用这个config，来连接到Kubernetes集群。

另外，您也可以在dev box机器上运行命令`ansible-playbook -i ${HOME}/pai-deploy/kubespray/inventory/pai/hosts.yml set-kubectl.yml --ask-become-pass`，来安装默认的`kubeconfig`环境和`kubectl`。该命令会把Kubernetes的config拷贝到`~/.kube/config`，并安装`kubectl`。成功运行后，您就可以直接在dev box机器上使用`kubectl`来控制集群了。

#### 关于网络问题的提示

如果您遇到网络问题，如机器无法下载某些文件，或无法连接到某个docker registry，请将提示的错误日志和kubespray合并为关键字，并搜索解决方案。您也可以参考[安装常见问题解答和故障排查](./installation-faqs-and-troubleshooting.md#troubleshooting)和[这个issue](https://github.com/microsoft/pai/issues/4516)。


## 安装OpenPAI服务

Kubernetes安装成功后，请使用下面的代码来安装OpenPAI服务：

```bash
/bin/bash quick-start-service.sh
```

如果一切顺利，您将会看到下面的信息：

```
Kubernetes cluster config :     ~/pai-deploy/kube/config
OpenPAI cluster config    :     ~/pai-deploy/cluster-cfg
OpenPAI cluster ID        :     pai
Default username          :     admin
Default password          :     admin-password

You can go to http://<your-master-ip>, then use the default username and password to log in.
```

正如这个提示所说的，您可以用 `admin` 和 `admin-password` 来登录Webportal，并提交一个任务来验证安装。另外，我们已在目录`~/pai-deploy/cluster-cfg`下生成了OpenPAI的配置文件，如果您之后需要自定义集群的话，这些配置文件有可能会被用到。

**如果您使用的worker是CPU worker、NVIDIA GPU worker、AMD GPU worker、Enflame DTU worker之外的worker种类**: 请在集群中手动安装设备的device plugin，否则会无法使用Kubernetes default scheduler。 目前可以自动安装的device plugin被列在[这个文件中](https://github.com/microsoft/pai/blob/master/src/device-plugin/deploy/start.sh.template)。您可以提交PR来支持您的设备。

## <div id="keep-a-folder">保留一个文件夹</div>

我们强烈建议您保留文件夹`~/pai-deploy`，以便将来进行升级、维护和卸载操作。此文件夹中最重要的内容包括：

  - Kubernetes集群配置（默认在`~/pai deploy/kube/config`）：Kubernetes配置文件。`kubectl`使用它连接到k8s api服务器。
  - OpenPAI服务配置（默认为`~/pai-deploy/cluster-cfg`）：一个包含您所有机器信息、OpenPAI服务配置的文件夹。

如果可能，可以备份`~/pai-deploy`以防意外删除。

除了文件夹之外，您还应该记住OpenPAI集群ID，它的默认值为`pai`。有些集群管理操作需要确认此ID。
