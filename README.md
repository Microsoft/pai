# Open Platform for AI (PAI) ![alt text][logo]

[logo]: ./pailogo.jpg "OpenPAI"

[![Build Status](https://travis-ci.org/Microsoft/pai.svg?branch=master)](https://travis-ci.org/Microsoft/pai)
[![Coverage Status](https://coveralls.io/repos/github/Microsoft/pai/badge.svg?branch=master)](https://coveralls.io/github/Microsoft/pai?branch=master)


## Introduction

Platform for AI (PAI) is a platform for cluster management and resource scheduling.
The platform incorporates the mature design that has a proven track record in Microsoft's large scale production environment.

PAI supports AI jobs (e.g., deep learning jobs) running in a GPU cluster. The platform provides PAI [runtime environment](https://github.com/Microsoft/pai/blob/master/job-tutorial/README.md) support, with which existing [deep learning frameworks](./examples/README.md), e.g., CNTK and TensorFlow, can onboard PAI without any code changes. The runtime environment support provides great extensibility: new workload can leverage the environment support to run on PAI with just a few extra lines of script and/or Python code.

PAI supports GPU scheduling, a key requirement of deep learning jobs. 
For better performance, PAI supports fine-grained topology-aware job placement that can request for the GPU with a specific location (e.g., under the same PCI-E switch).

PAI embraces a [microservices](https://en.wikipedia.org/wiki/Microservices) architecture: every component runs in a container.
The system leverages [Kubernetes](https://kubernetes.io/) to deploy and manage static components in the system.
The more dynamic deep learning jobs are scheduled and managed by [Hadoop](http://hadoop.apache.org/) YARN with our [GPU enhancement](./hadoop-ai/README.md). 
The training data and training results are stored in Hadoop HDFS.

## An Open AI Platform for R&D and Education 

One key purpose of PAI is to support the highly diversified requirements from academia and industry. PAI is completely open: it is under the MIT license. PAI is architected in a modular way: different module can be plugged in as appropriate. This makes PAI particularly attractive to evaluate various research ideas, which include but not limited to the following components: 

* Scheduling mechanism for deep learning workload
* Deep neural network application that requires evaluation under realistic platform environment
* New deep learning framework
* AutoML
* Compiler technique for AI
* High performance networking for AI
* Profiling tool, including network, platform, and AI job profiling
* AI Benchmark suite
* New hardware for AI, including FPGA, ASIC, Neural Processor
* AI Storage support
* AI platform management 

PAI operates in an open model. It is initially designed and developed by [Microsoft Research (MSR)](https://www.microsoft.com/en-us/research/group/systems-research-group-asia/) and [Microsoft Search Technology Center (STC)](https://www.microsoft.com/en-us/ard/company/introduction.aspx) platform team.
We are glad to have [Peking University](http://eecs.pku.edu.cn/EN/), [Xi'an Jiaotong University](http://www.aiar.xjtu.edu.cn/), [Zhejiang University](http://www.cesc.zju.edu.cn/index_e.htm), and [University of Science and Technology of China](http://eeis.ustc.edu.cn/) join us to develop the platform jointly. 
Contributions from academia and industry are all highly welcome.

## System Deployment

### Prerequisite

The system runs in a cluster of machines each equipped with one or multiple GPUs. 
Each machine in the cluster runs Ubuntu 16.04 LTS and has a statically assigned IP address.
To deploy services, the system further relies on a Docker registry service (e.g., [Docker hub](https://docs.docker.com/docker-hub/)) 
to store the Docker images for the services to be deployed.
The system also requires a dev machine that runs in the same environment that has full access to the cluster.
And the system need [NTP](http://www.ntp.org/) service for clock synchronization.

### Deployment process
To deploy and use the system, the process consists of the following steps.

1. Deploy PAI following our [bootup process](./pai-management/doc/cluster-bootup.md)
2. Access [web portal](./webportal/README.md) for job submission and cluster management


#### Job management

After system services have been deployed, user can access the web portal, a Web UI, for cluster management and job management.
Please refer to this [tutorial](job-tutorial/README.md) for details about job submission.

#### Cluster management

The web portal also provides Web UI for cluster management.

## System Architecture

<p style="text-align: left;">
  <img src="./sysarch.png" title="System Architecture" alt="System Architecture" />
</p>

The system architecture is illustrated above. 
User submits jobs or monitors cluster status through the [Web Portal](./webportal/README.md), 
which calls APIs provided by the [REST server](./rest-server/README.md).
Third party tools can also call REST server directly for job management.
Upon receiving API calls, the REST server coordinates with [FrameworkLauncher](./frameworklauncher/README.md) (short for Launcher)
to perform job management.
The Launcher Server handles requests from the REST Server and submits jobs to Hadoop YARN. 
The job, scheduled by YARN with [GPU enhancement](https://issues.apache.org/jira/browse/YARN-7481), 
can leverage GPUs in the cluster for deep learning computation. Other type of CPU based AI workloads or traditional big data job
can also run in the platform, coexisted with those GPU-based jobs. 
The platform leverages HDFS to store data. All jobs are assumed to support HDFS.
All the static services (blue-lined box) are managed by Kubernetes, while jobs (purple-lined box) are managed by Hadoop YARN. 

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
