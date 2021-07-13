# OpenPAI Release Note

## July 2021 (version 1.8.0)

- Marketplace related update
  - Please see [Marketplace](https://github.com/microsoft/openpaimarketplace/releases/tag/v1.8.0) for more details

- Alert manager
  - Send alert to users when job status changed #5337

- Webportal
  - Support UX of Job Priority #5417

- Others
  - Customizable Autoscaler #5412
  - Add custom ssl port support #5386
  - Clean up repo. Remove obsolete code #5489

## April 2021 (version 1.7.0)

- Marketplace related update
  - Please see [Marketplace](https://github.com/microsoft/openpaimarketplace/releases/tag/v1.7.0) for more details

- New job submission page
  - Please refer to [new submission tutorial](https://github.com/microsoft/pai/blob/pai-1.7.y/docs/manual/cluster-user/how-to-use-new-submission-page.md) for how to use new submission page.
  - New submission page replaces `Advanced` with `More info` and places it under each section to improve user experience.
  - In new submission page, the sidebar can be shrank to give the main area more visual space.
  - The new submission page moves the yaml editor into a single page, which allows user to focus on setting config or editing yaml protocol.
  - The new submission page improves the responsive design in small and medium resolution.

  > Know Issue: Tensorboard tool is not implemented in the new submission page yet. If you need to use it, please use the old version.

- Alert system enhancement
  - Add alert & auto-fix for GPU perf issue #5342 #5383
  - Refine `kill-low-efficiency-job-alert` email templates #5384
  - Add alert for API server cert expired #5334

- Support sort by `completionTime` for get job list API #5347

- Deployment
  - Support add/remove nodes via `paictl.py` #5321 #5167. (**Warning** `config.yaml` need to be added for this feature. refer: https://github.com/microsoft/pai/blob/master/docs/manual/cluster-admin/how-to-add-and-remove-nodes.md#pull--modify-cluster-settings)

- Bug fixes:
  - Webportal package build issue #5378

## Mar 2021 (version 1.6.0)

- Job protocol update: Add prerequisites #5145

- Marketplace related update
  - Please see [Marketplace](https://github.com/microsoft/openpaimarketplace/releases/tag/v1.6.0) for more details
  - **Warning** Marketplace v1.6.0 has some breaking change, upgrade from previous should follow the [Marketplace upgrade guide](https://openpaimarketplace.readthedocs.io/en/v1.6.0/admin/deploy_v1.6.0_later.html#deployment-in-a-openpai-cluster)

- Introduce an optional docker cache in cluster #5290

- A regular GPU utilization report can be set up for admins #5281, #5294, #5324, #5331
  - #5324 introduces a schema change for `pai-bearer-token` in the `alert-manager` section. The old configuration still works but is deprecated. If you have configured `pai-bearer-token` of `alert-manager`, please refer to #5331 to modify the previous configuration.

- Users can save frequently-used SSH publish keys on the profile page #5223

- Improve log experience #5271 #5272

- Reduce ansible logs when deploy #5305

- Bug Fixes:
  - Database controller: Tolerant to wrong framework spec #5284
  - Database controller: Remove sensitive fields in db #5289
  - Database controller: Fix memory leak #5309
  - Set correct launchTime in rest-server #5307
  - Database may use unmounted host path #5343

## Jan 2021 (version 1.5.0)

- Improve Web Portal Experience
  - Fix Home page overlap issue #5213 #5180
  - Add filter, search box and export csv button in task detail list #5175
  - Create a new page for yaml editor #5172

- Marketplace related update
  - Please see https://github.com/microsoft/openpaimarketplace/issues/152 for more details

- Support different types of computing hardware #5138

- Deployment process refinement
  - `master.csv` + `worker.csv` -> `layout.yaml`
  - move `config.yaml`, `layout.yaml` under quick-start folder, remove all the argument parse logic
  - Add support for cpu-only worker installation
  - Add support for heterogeneous workers
  - Unify version requirements: pai version, pai image tag
  - Set default value in config files
  - Generate hiveD config with `layout.yaml` #5179
  - Check layout before installing k8s #5184 #5181
  - Config folder structure arrangement
  - Refine installation logs
  - Add skip service list argument #5193

- Log manager
  - Change get logs api return code #5125

## Dec 2020 (version 1.4.1)

- Marketplace
  - Fix initializing blob data issue (#5189)
- Log Collection
    - Fix getting wrong log for retried task & frontend crash issue (#5190)

## Dec 2020 (version 1.4.0)

- multi-cluster (https://github.com/microsoft/pai/issues/4929)
  - Support job transfer (#5082, #5088)
- Autoscaler
  - Update docs for Cluster Autoscaler on AKS Engine (#5057)
- Log Collection (https://github.com/microsoft/pai/issues/4992)
    - Rest API
    - Webportal
- Https configuration document (#5076, #5078)
- Marketplace (https://github.com/microsoft/openpaimarketplace/issues/73)
  - Data
    - Move NFS to Azure Blob as backend
    - Upload Job output to Azure Blob
    - Download data from azure blob to local
    - Use Azure storage SDK for privacy
    - Refactor data use logic after change storage to blob
    - Update project development doc and manual
  - Service Deployment
    - Start Local Rest Server
    - Deployed Rest Server in PAI
    - Start database and save items into it
    - Register in PAI pylon (#5066)
    - Add azure storage to service configuration (#5104)
- Web Portal
  - Fix stop job button issue #5079
- Admin Experience
  - Prometheus alert rules update (#5021)
  - Refine deployment process (#5077, #5085)
- Others
  - Fix `updateUserGroupList` API issue (#5121)
  - Fix hived config issue caused by k8s coreDNS deployment (#5071)

## Nov 2020 (version 1.3.0)

- Marketplace
  - New templates in marketplace (https://github.com/microsoft/openpaimarketplace/issues/60)
- HiveD Scheduler
  - Support cluster autoscale with HiveD scheduler on AKS (#4868)
  - Support dynamic sku types for different vc on webportal (#4900)
- Advanced job debug mode
  - Add per task retry history (https://github.com/microsoft/frameworkcontroller/pull/62, #4958, #4966)
  - Expose Kubernetes events (#4939, #4975)
- GPU monitoring and utilization
  - Support job tagging (#4924)
  - Stop low GPU utilization job with alert-manager (#4940)
  - Cordon node with GPU ECC Errors (#4942)
- Documentation
  - Fix document according to DRI tickets (#4828)
  - Add distributed examples (#4821)
- Webportal
  - Add help info for items on webportal (#4950)

## Oct 2020 (version 1.2.1)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v1.2.1).

## Sep 2020 (version 1.2.0)

- Database
  - New RestServer Arch: RestServer -> DB -> ApiServer (#4651)
- Webportal
  - Job list paging in server side (#4651)
  - Change job createdTime to submissionTime (#4761)
  - VC && Group experience for Admin (AAD Mode) (#4800)
  - Support SKU count and SKU type in job submission page (#4796)
  - Upgrade api/v1 code to api/v2 (#4704)
  - Show "More Diagnostics" in job detail page (#4670)
- Marketplace
  - [Unified PAI protocol](https://github.com/microsoft/openpaimarketplace#49)
  - [Merge examples](https://github.com/microsoft/openpaimarketplace#41)
- Others
  - HiveD improvement (#4868)
  - Robustness improvement (#4694)
  - Fix logrotate issue (#4792)
  - Fix [runtime image check issue](https://github.com/microsoft/openpai-runtime#17)
  - Fix error message for SKU (#4602)
  - [Quick start for AKS-Engine](https://github.com/microsoft/pai/blob/v1.2.0/contrib/aks-engine/readme.md)
- [Old framework retry history cannot be shown after upgrading to v1.2.0](https://github.com/microsoft/pai/issues/4930)
- [Upgrade Guide](https://openpai.readthedocs.io/en/latest/manual/cluster-admin/upgrade-guide.html)

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v1.2.0).

## July 2020 (version 1.1.1)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v1.1.1).

## July 2020 (version 1.1.0)

- Storage:
  - Support readonly storage. (#4523)
- Security
  - If ssl is enabled, all requests will use https. (#4550)
- Authentication
  - Support nested AD group in AAD Mode. (#4639)
- Marketplace
  - Integrate with new version of [PAI marketplace](https://github.com/microsoft/openpaimarketplace).
- Others
  - Add stress test for PAI API. (#4665)
  - Resolve job always retry for port conflict. (#4384)
  - Webportal/VScode use JS SDK + SDK improvement. (#4660)
  - Align webportal submit default value with backend. (#4682)
  - Document enhance. (#4700)
  - Fix tensorboard v2 the logdir is not correct issue.
  - Fix webPortal submit job help link broken.
  - Fix ssh barrier bug.

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v1.1.0).

## May 2020 (version 1.0.1)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v1.0.1).

## May 2020 (version 1.0.0)

With the v1.0.0 release, OpenPAI is officially switching to pure Kubernetes-based architecture. In addition to this, we had also made efforts on making our component design more modularized by re-organized the code structure to 1 main repo together with 7 standalone key component repos.

Please refer to the [system architecture](https://github.com/microsoft/pai/blob/master/docs/system_architecture.md) documentation for more detailed design thinkings about this change, and review the following list to get a better understanding about the 7 new component repos:

  - [hivedscheduler](https://github.com/microsoft/hivedscheduler) is a new OpenPAI component providing various advantages over standard k8s scheduler, such as resource isolation for multiple tenants, GPU topology guarantee for virtual clusters, and better topology-aware gang scheduling with no [resource starvation](https://en.wikipedia.org/wiki/Starvation_(computer_science)).
  - [frameworkcontroller](https://github.com/microsoft/frameworkcontroller) is built to orchestrate all kinds of applications on Kubernetes by a single controller.
  - [openpai-protocol](https://github.com/microsoft/openpai-protocol) is the specification of OpenPAI job protocol. It facilitates platform interoperability and job portability. A job described by the protocol can run on different clusters managed by OpenPAI. The protocol also enables great flexibility. Any AI workload can be described by it conveniently.
  - [openpai-runtime](https://github.com/microsoft/openpai-runtime) provides runtime support which is necessary for the OpenPAI protocol. OpenPAI runtime can classify typical runtime error patterns and prevent unnecessay error retries. Therefore cluster resource can be saved.
  - [openpaisdk](https://github.com/microsoft/openpaisdk) is a JavaScript SDK designed to facilitate the developers of OpenPAI to offer more user-friendly experience.
  - [openpaimarketplace](https://github.com/microsoft/openpaimarketplace) is a service which stores examples and job templates. Users can use it from webportal plugin to share their jobs or run-and-learn others' sharing job.

    Features:

    1. Provide a way for team collaboration among pai users.
    2. Provide an easy-to-start and education for new users. Users could refer to shared templates in marketplace and learn how to use pai platform correct.
    3. Provide admin review process to ensure the quality of templates in marketplace.

  - [openpaivscode](https://github.com/microsoft/openpaivscode) is a VSCode extension, which makes users connect OpenPAI clusters, submit AI jobs, simulate jobs locally and manage files in VSCode easily.

The version of each standalone repo used in OpenPAI `v1.0.0` is hivedscheduler `v0.3.2`, frameworkcontroller `v0.6.0`, openpai-protocol `v2.0.0-alpha`, openpai-runtime `v0.1.0`, openpaisdk `v0.1.0`, openpaimarketplace `v1.2.0` and openpaivscode `v0.3.0`.

Other major new features and improvements come with this new release are:

  - Based on [kubespray](https://github.com/microsoft/pai/tree/master/contrib/kubespray), we provided a [quick start script](https://openpai.readthedocs.io/en/release-1.0.0/manual/cluster-admin/installation-guide.html) for you to deploy OpenPAI from scratch faster.
  - In addition to basic authentication, [support for Azure Active Directory (AAD)](https://openpai.readthedocs.io/en/release-1.0.0/manual/cluster-admin/how-to-manage-users-and-groups.html#users-and-groups-in-aad-mode) was added to provide SSO and multi-factor authentication for users.
  - Built-in storage were refactored to support more storage types with [a unified interface](https://openpai.readthedocs.io/en/release-1.0.0/manual/cluster-admin/how-to-set-up-pv-storage.html).
  - [Storage manager](https://github.com/microsoft/pai/tree/master/src/storage-manager) is provided for users to set up NFS+SMB storage server easily.
  - [Webportal UX is upgraded to Microsoft Fluent UI 7.0](https://github.com/microsoft/pai/issues/4024). UI component and style elements are optimized to provide more user-friendly experience for both user and admin scenarios.
  - [RESTful API has been refined](https://github.com/microsoft/pai/issues/4337) to be cleaner and more well-organized. [A detailed swagger document](https://redocly.github.io/redoc/?url=https://raw.githubusercontent.com/microsoft/pai/master/src/rest-server/docs/swagger.yaml) is also provided.
  - In addition to current documentation, we provide [an end-to-end usage manual](https://openpai.readthedocs.io/) for cluster users and administrators to learn how to use OpenPAI.

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v1.0.0).

## July 2019 (version 0.14.0)

Welcome to the July 2019 release of OpenPAI. There are a number of updates in this version that we hope you will like, some of the key highlights include:

- [New webportal job submission experience](https://github.com/microsoft/pai/blob/v0.14.0/docs/user/job_submission.md) - Update submit job UI to version 2.
- [Python sdk of openpai is now ready!](https://github.com/microsoft/pai/tree/master/contrib/python-sdk) - You can config, submit and debug your job easily with python sdk.
- [New yarn schedular to improve resource efficiency](https://github.com/microsoft/pai/blob/v0.14.0/docs/tools/dedicated_vc.md) - Admin can bind dedicated Virtual Cluster to 1 or more physical nodes.
- [vscode extension now supports submitting v2 job](https://github.com/microsoft/openpaivscode/tree/master).
- [Provide team storage plugin to manage data shared by team](https://github.com/microsoft/pai/tree/master/contrib/storage_plugin).
- [How to upgrade to OpenPAI v-0.14.0?](https://github.com/microsoft/pai/blob/v0.14.0/docs/upgrade/upgrade_to_v0.14.0.md)

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.14.0).

## June 2019 (version 0.13.0)

- OpenPAI protocol:
  - Introduce OpenPAI protocol and job submission v2 (#2260)
  - Add new job submission v2 plugin (#2461)
- Web portal:
  - Add login page for guests (#2544)
  - Add user home page (#2614)
  - Add new user management page (#2726, #2796)
  - User Management UX refactoring with new layout and themes (#2726, #2796)

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.13.0).

## April 2019 (version 0.12.0)

- Web portal:
  - Display error message in job detail page #2456
  - Import users from CSV file directly and show the final results #2495
  - Add TotalGpuCount and TotalTaskCount into job list #2499
- Deployment
  - Add cluster version info #2528
  - Check if the nodes are ubuntu 16.04 #2520
  - Check duplicate hostname #2403

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.12.0).

## April 2019 (version 0.11.0)

- Support team wise NFS storage, including:
  - An NFS configuration plug-in and a commandline tool. #2346
  - A simple NFS-job submit plug-in. #2358
- Refer to Simplified Job Submission for OpenPAI + NFS deployment for more details.
- New alerts for unhealthy GPUs, currently including following alerts #2209:
- Admin could know all running jobs on a node. #2197
- Filter supports in Job List View. #302
- Hold the Env for failed jobs which are caused by user error. #2272

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.11.0).

## Mar 2019 (version 0.10.1)

- Admin can configure MaxCapacity through REST API for a given Virtual Cluster so that the virtual cluster can use iddle resources as bonus. #2147
- Support Azure RDMA. #2091; how-to doc
- New Disk Cleaner for abnormal disk usage: The disk cleaner will check disk usage every 60 second(configurable), and if the disk usage is above 94%(configurable), it will kill the container that uses largest disk space using specific signal(10), the container will exit with code 1, and the related job will fail. Admin/User can track the reason in job logs. #2119
- Web portal: add "My jobs" filter button. #2111
- "Submit Simple Job" web portal plugin. #2131

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.10.1).

## Feb 2019 (version 0.9.1)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v0.9.1).

## Feb 2019 (version 0.9.0)

- Add pai service dashboard to grafana, cluster admin can get pai services resource consumption from paiServiceMetrics page. #1694
- Support to add custom web pages to the web portal of PAI deployments with WebPortal Plugin, refer to Plugins Doc for how to use the new feature, and refer to PR 1700 for how PAI Marketplace is using it as an example.
- Support update virtual cluster dynamically from webportal. Please refer to virtual cluster management for how to use this new feature. #1831 #1974
- Support customized job environment variables. #1544
- Add VS Code client for PAI, please refer to OpenPAI VS Code Client for more detail.

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.9.0).

## Dec 2018 (version 0.8.3)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v0.8.3).

## Nov 2018 (version 0.8.2)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v0.8.2).

## Nov 2018 (version 0.8.1)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v0.8.1).

## Oct 2018 (version 0.8.0)

- All user submitted jobs can be cloned and resubmitted in Job detail page #1448.
- The new designed Marketplace and Submit Job V2 are under public review. Please refer to the instruction for more information Marketplace and Submit job v2. Any feedback and suggestions are appreciated.
- Alerting service supports to mute alerts. The instructions can be found via alert-manager.
- New Feedback Button: users are allowed to submit GitHub Issues with appended OpenPAI version directly from WebUI #1289.

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.8.0).

## Sep 2018 (version 0.7.2)

[minor release with hot fix](https://github.com/microsoft/pai/releases/tag/v0.7.2).

## Aug 2018 (version 0.7.1)

- Administrators can receive email notifications on cluster problems after set up the new supported "Alert Manager". Please read more about how to set up Alert Manager and the notification Rules.

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.7.1).

## July 2018 (version 0.6.1)

- The 'paictl' tool: Introducing paictl, the deployment/management tool with the functionalities of image building, service start/stop, k8s bootup/clean, and configuration generation.
- Single-box deployment: Support single-box deployment for evaluation purpose.
- New UI for user management: Now the console for administrators to manage PAI users has got a new UI.
- Documentation: Significant changes on documents -- more comprehensive, more structured, and easier to follow.

For more details about this release, please refer to [detailed release note](https://github.com/microsoft/pai/releases/tag/v0.6.1).
