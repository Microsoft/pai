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
branch-name: master
docker-image-tag: quick-start
user: forexample
password: forexample
```

###### Check environment requirement

```shell script
/bin/bash requirement.sh -m /path/to/master.csv -w /path/tp/worker.csv -c /path/to/config
```
