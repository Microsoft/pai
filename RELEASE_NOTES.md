# Release v0.10.0 #

## New Features ##

* "Submit Simple Job" web portal plugin [#2131](https://github.com/Microsoft/pai/pull/2131)
* Support configure vc bonus [#2147](https://github.com/Microsoft/pai/pull/2147)
* Web portal: add "My jobs" filter button. [#2111](https://github.com/Microsoft/pai/pull/2111)
* Support AKS deployment [#1980](https://github.com/Microsoft/pai/pull/1980)
* Diawang/dockercleaner [#2119](https://github.com/Microsoft/pai/pull/2119)
* PAI VS Code extension [#1984](https://github.com/Microsoft/pai/pull/1984)
* Support Azure RDMA [#2091](https://github.com/Microsoft/pai/pull/2091)

## Improvements ##

### Service ###

* Web Portal: Allow jsonc in job submission [#2084](https://github.com/Microsoft/pai/pull/2084)
* Grafana: Use yarn's metrics in cluster view [#2148](https://github.com/Microsoft/pai/pull/2148)
* Alart Manager: Make it more clear in service not up [#2105](https://github.com/Microsoft/pai/pull/2105)
* Hadoop: extend nm expiry time to 60 mins [#2142](https://github.com/Microsoft/pai/pull/2142)
* Pylon: WebHDFS library compatibility [#2134](https://github.com/Microsoft/pai/pull/2134)
* Kubernetes: Disable kubernetes's pod eviction [#2124](https://github.com/Microsoft/pai/pull/2124)
* Hadoop: Reduce am resource [#2072](https://github.com/Microsoft/pai/pull/2072)
* Expose log retain time [#2034](https://github.com/Microsoft/pai/pull/2034)
* Hadoop: disable hdfs shortcircuit [#2027](https://github.com/Microsoft/pai/pull/2027)

### Command ###

* Deploy: Only restart docker deamon, if the configuration is updated. [#2138](https://github.com/Microsoft/pai/pull/2138)
* Build: Add error message when image build failed [#2133](https://github.com/Microsoft/pai/pull/2133)

### Documentation ###

* HDFS data migration doc [#2096](https://github.com/Microsoft/pai/pull/2096)
* Note tell user take care dev-box-version for doc [#2087](https://github.com/Microsoft/pai/pull/2087)
* Add issue to readme [#2044](https://github.com/Microsoft/pai/pull/2044)
* Update document about docker data root's configuration [#2052](https://github.com/Microsoft/pai/pull/2052)

### Examples ###

* Add an exmaple of horovod with rdma & intel mpi [#2112](https://github.com/Microsoft/pai/pull/2112)
* Add /usr/local/cuda/extras/CUPTI/lib64 to LD_LIBRARY_PATH [#2043](https://github.com/Microsoft/pai/pull/2043)

## Bug Fixes ##

* Issue [#2099](https://github.com/Microsoft/pai/pull/2099) is fixed by
  * Launcher: Revise the definition of Framework running state [#2135](https://github.com/Microsoft/pai/pull/2135)
  * REST server: Classify two states to WAITING [#2154](https://github.com/Microsoft/pai/pull/2154)

## Upgrading from Earlier Release ##

* Download the code package of release v0.10.0 from [release page](https://github.com/Microsoft/pai/releases),
  or you can clone the code by running:

  ```bash
  git clone --branch v0.10.0 git@github.com:Microsoft/pai.git
  ```

* Prepare your cluster configuration by instructions in [OpenPAI Configuration](./docs/pai-management/doc/how-to-write-pai-configuration.md).
  In the *service-configuration.yaml* file, configure the docker info as following:

  ```yaml
  docker-namespace: openpai
  docker-registry-domain: docker.io
  docker-tag: v0.10.0
  ```

* In the code source directory, upgrade by following steps:

  ```bash
  # Stop the services
  python paictl.py service stop -p cluster_configuration_file_path
  # After the services are stopped, stop the kubernetes cluster
  python paictl.py cluster k8s-clean -p cluster_configuration_file_path
  # Reboot the kubernetes cluster
  python paictl.py cluster k8s-bootup -p cluster_configuration_file_path
  # Push cluster configuration file to kubernetes
  python paictl config push -p cluster_configuration_file_path
  # Start the services
  python paictl.py service start
  ```
