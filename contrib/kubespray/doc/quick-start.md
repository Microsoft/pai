### Quick Start

#### Prepare configuration

- master.csv: machine-list of infra nodes. Infra nodes is used to deploy etcd cluster and k8s-master node (single master).
- worker.csv: machine-list of worker nodes. Worker nodes is used to deploy kubernetes worker nodes
- config: Configuration of OpenPAI service.


##### Write master.csv

###### master.csv format
```
hostname(Node Name in k8s),host-ip
```
###### master.csv example
```
openpai-master-01,10.1.0.1
```
##### Write worker.csv
###### master.csv format
```
hostname(Node Name in k8s),host-ip
```
###### worker.csv example
```
openpai-001,10.0.0.1
openpai-002,10.0.0.2
openpai-003,10.0.0.3
openpai-004,10.0.0.4
```
##### Write config

```yaml
branch-name: <% latest-release %>
docker-image-tag: <% latest-release %>
user: forexample
password: forexample

# Optional
# docker-registry-domain: docker.io
# docker-registry-namespace: openpai
# docker-registry-username: exampleuser
# docker-registry-password: examplepasswd

# docker-data-root: /mnt/docker
# docker-iptables-enabled: false
# gcr-image-repo: "gcr.io"
# kube-image-repo: "gcr.io/google-containers"
# quay-image-repo: "quay.io"
# docker-image-repo: "docker.io"
```

###### start kubernetes

```shell script
/bin/bash quick-start-kubespray.sh -m /path/to/master.csv -w /path/tp/worker.csv -c /path/to/config
```

######  start OpenPAI

This script should be executed after ```start kubernetes```

```shell script
/bin/bash quick-start-service.sh -m /path/to/master.csv -w /path/tp/worker.csv -c /path/to/config
```