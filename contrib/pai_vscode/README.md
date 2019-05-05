# OpenPAI VS Code Client

OpenPAI VS Code Client is an extension to connect PAI clusters, submit AI jobs, simulate jobs locally, manage files, and so on.

## Connect to an OpenPAI cluster

Before using OpenPAI VS Code Client, follow below steps connecting to an OpenPAI cluster.

Notice, it needs the version OpenPAI cluster >= 0.8.0

1. Use shortcut key Ctrl+Shift+P to open command palette.
2. Input and look for *PAI: Add PAI Cluster* as below.

    ![add cluster](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/add_cluster.png)

3. Press *Enter*, and it asks to input the host of OpenPAI. It can be domain name or IP Address. After that, press enter again.

    ![add cluster host](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/add_cluster_host.png)

4. A configuration file is opened, and you need to update username and password field at least. Once it completes, click *Finish* button at right bottom corner. Notice, it won't be effect, if you save and close the file directly.

    ![add cluster configuration](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/add-cluster-finish.png)

If there are multiple OpenPAI clusters, you can follow above steps again to connect with them.

## Submit job

After added a cluster configuration, you can find the cluster in *PAI CLUSTER EXPLORER* pane as below.

![pai cluster explorer](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/pai_cluster_explorer.png)

You can create a job configuration and submit to OpenPAI as below steps.

1. Double click *Create Job Config...* in OpenPAI cluster Explorer, and then specify file name and location to create a job configuration file.
2. Update job configuration as needed. If you are not familiar with this configuration file, learn from [here](https://github.com/Microsoft/pai/blob/master/docs/user/training.md#learn-hello-world-job).
3. Right click on the created job configuration file, then click on *Submit Job to PAI Cluster*. The client will upload files to OpenPAI and create a job. Once it's done, there is a notification at right bottom corner, you can click to open the job detail page.

    If there are multiple OpenPAI clusters, you need to choose one.

    This animation shows above steps.
    ![submit job](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/submit-job.gif)

## Local simulation

As it needs sometime to wait job starting in OpenPAI cluster, local simulation can help identifying and debugging most code, environment and configuration issues quickly.

### Prerequisites

[Docker](https://docs.docker.com/install/) MUST be installed to use local simulation.

### Steps

1. As submit a job, you can right click a configuration file to find local simulation.
2. Click *Simulate PAI Job Running*, after a while below notification shows.

    ![simulate running](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/simulate_running.png)

3. you can click on *Simulate first task in VS Code terminal* to simulate directly, or *Reveal in Explorer* to view created docker files and start simulation manually.

This animation shows above steps.
![simulate job](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/simulate-job.gif)

### Limitations

As local simulation is a close but still different environment with OpenPAI cluster, there are some issues cannot be found by simulation. Some examples,

* The job may need much more memory or distributed environments. It cannot be simulated locally.
* The job may need GPU, but local computer may not have one. It may need code logic to handle this situation. It also needs a different docker image if you are using TensorFlow. As TensorFlow has different package for GPU and non-GPU runtime.
* The job may run much more time locally. In most case, the computing power of local computer is much lower than servers in the OpenPAI cluster. If you need to simulate a job end-to-end, it may need to reduce iterations to get result faster.
* Local machine may not be able to access some storage. The OpenPAI cluster may be deployed in a private environment, so that local computer may not able to access resource of cluster.

## Manual

### GUI

The client has two GUI parts. First is the *PAI CLUSTER EXPLORER* in explorer and used in above introduction. Second can be opened by the icon in activity bar.

![activity bar](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/activity_bar.png)

There are two parts in the side bar.

* HDFS Explorer

    You can view, upload and download folder and files of the OpenPAI cluster storage.

* Job List

    You can view jobs in OpenPAI cluster. The lists refresh periodically, and the icon shows the status of each job. You can open a job in browser with double clicking it.

![job list](https://raw.githubusercontent.com/Microsoft/pai/master/contrib/pai_vscode/assets/job-list.png)

## Commands

### Command Palette

| Name                            | Description                               |
| ------------------------------- | ----------------------------------------- |
| PAI: Add PAI Cluster            | Add a new OpenPAI cluster                 |
| PAI: Open Dashboard             | View OpenPAI cluster in browser           |
| PAI: Submit Job to PAI Cluster  | Submit an OpenPAI job                     |
| PAI: Create PAI Job Config File | Create an OpenPAI configuration file      |
| PAI: Simulate PAI Job Running   | Generate Docker file for local simulation |

### PAI Cluster Explorer

| Name                    | Description                                   |
| ----------------------- | --------------------------------------------- |
| Open Web Portal...      | Browse to OpenPAI's web portal                |
| List Jobs...            | Open PAI's job list page in VS Code           |
| Create Job Config...    | Create an OpenPAI configuration file          |
| Submit Job...           | Submit an OpenPAI job                         |
| Simulate Job Running... | Generate Docker file for local simulation     |
| Edit Configuration...   | Edit OpenPAI cluster configuration            |
| Open HDFS...            | Open HDFS storage explorer of OpenPAI cluster |

## Settings

| ID                               | Description                                             |
| -------------------------------- | ------------------------------------------------------- |
| pai.job.upload.enabled           | Whether will upload files to codeDir of configuration   |
| pai.job.upload.exclude           | Excluded files and folders for uploading                |
| pai.job.upload.include           | Included files and folders for uploading                |
| pai.job.generateJobName.enabled  | Whether add a random suffix to job name when submitting |
| pai.job.jobList.recentJobsLength | The number in *Recent Submitted Jobs from VS Code*      |
| pai.job.jobList.allJobsPageSize  | The page size of the *All Jobs* list                    |
| pai.job.jobList.refreshInterval  | The refresh interval of job list (in seconds)           |
| pai.hdfs.location                | Where HDFS storage will be shown                        |

## Contributing

https://github.com/Microsoft/pai#how-to-contribute

## Issue and suggestions

Submit at [GitHub](https://github.com/Microsoft/pai/issues)

## License

MIT
