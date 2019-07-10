// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
// to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
// BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import React, { Suspense, lazy } from "react";
import {
  ChoiceGroup, ComboBox, IComboBox, DefaultButton, DefaultPalette, Fabric, IChoiceGroupOption, IRenderFunction,
  Label, List, Panel, PanelType, PrimaryButton, Stack, Spinner, SpinnerSize, Text, TextField, Toggle,
  initializeIcons, mergeStyleSets, IComboBoxOption,
} from "office-ui-fabric-react";
import Cookies from "js-cookie";
import classNames from "classnames/bind";
import update from "immutability-helper";
import yaml from "js-yaml";

import monacoStyles from "./monaco.scss";
import MarketplaceForm from "./MarketplaceForm";

const externalStorageTypeOptions: IComboBoxOption[] = [
  { key: "hdfs", text: "HDFS" },
  { key: "nfs", text: "NFS" },
];
const MonacoEditor = lazy(() => import("react-monaco-editor"));
const styles = mergeStyleSets({
  form: {
    width: "50%",
    marginTop: "20px",
    alignSelf: "center",
    boxSizing: "border-box",
    boxShadow: "0 5px 15px rgba(0, 0, 0, 0.2)",
    borderStyle: "1px solid rgba(0, 0, 0, 0.2)",
    borderRadius: "6px",
    backgroundColor: DefaultPalette.white,
  },

  title: {
    fontWeight: "600",
  },

  subTitle: {
    fontSize: "16px",
    fontWeight: "300",
    color: DefaultPalette.neutralSecondary,
  },

  header: {
    width: "80%",
    paddingBottom: "20px",
    borderBottom: `1px solid ${DefaultPalette.neutralLight}`,
  },

  footer: {
    width: "80%",
    paddingTop: "20px",
    borderTop: `1px solid ${DefaultPalette.neutralLight}`,
  },

  item: {
    width: "80%",
    paddingRight: "20%",
  },

  fileItem: {
    width: "80%",
    paddingRight: "5%",
  },

  fileLabel: {
    width: "25%",
    position: "relative",
    minHeight: "1px",
    padding: "0",
  },

  fileBtn: {
    fontSize: "14px",
    fontWeight: "400",
    boxSizing: "border-box",
    display: "inline-block",
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    cursor: "pointer !important",
    touchAction: "manipulation",
    padding: "4px 16px",
    minWidth: "80px",
    height: "32px",
    backgroundColor: DefaultPalette.neutralLighter,
    color: `${DefaultPalette.black} !important`,
    userSelect: "none",
    outline: "transparent",
    border: "1px solid transparent",
    borderRadius: "0px",
    textDecoration: "none !important",
  },

  fileDisabled: {
    cursor: "not-allowed",
    filter: "alpha(opacity=60)",
    opacity: "0.60",
    boxShadow: "none",
    color: DefaultPalette.neutralLighterAlt,
    pointerEvents: "none",
  },

  fileInput: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    border: "0",
  },
});
const cx = classNames.bind(styles);

initializeIcons();

interface IParameterObj {
  [key: string]: string;
}

interface IParameterItem {
  key: string;
  value: string;
}

interface IProtocolProps {
  api: string;
  user: string;
  token: string;
  source?: {
    jobName: string;
    user: string;
    protocolItemKey: string | undefined;
    protocolYAML: string;
  };
  pluginId?: string;
}

interface IProtocolState {
  jobName: string;
  protocol: any;
  protocolYAML: string;
  fileOption: string | number | undefined;
  marketplaceOption: string | number | undefined;
  loading: boolean;
  showParameters: boolean;
  showEditor: boolean;
  logPath: string;
  externalStorage: any;
  enableTensorBoard: boolean;
}

export default class ProtocolForm extends React.Component<IProtocolProps, IProtocolState> {
  public state = {
    jobName: "",
    protocol: Object.create(null),
    protocolYAML: "",
    fileOption: "local",
    marketplaceOption: undefined,
    loading: true,
    showParameters: true,
    showEditor: false,
    logPath: "$TB_ROOT",
    externalStorage: Object.create(null),
    enableTensorBoard: false,
  };

  public componentDidMount() {
    this.fetchConfig();
  }

  public render() {
    return this.state.loading ?
      this.renderLoading() :
      this.readerContent();
  }

  private renderLoading = () => {
    return (
      <Fabric>
        <Stack>
          <Stack gap={20} padding={20} horizontalAlign="center" className={styles.form}>
            <Stack horizontal={true} horizontalAlign="center" className={styles.header}>
              <Text variant="xxLarge" nowrap={true} block={true} className={styles.title}>
                Submit Job v2 <span className={styles.subTitle}>Protocol Preview</span>
              </Text>
            </Stack>
            <Stack>
              <Spinner
                label="Loading Cloned Job ..."
                ariaLive="assertive"
                labelPosition="left"
                size={SpinnerSize.large}
              />
            </Stack>
          </Stack>
        </Stack>
      </Fabric>
    );
  }

  private readerContent = () => {
    const editorSpinner = (
      <Spinner
        label="Loading YAML Editor ..."
        ariaLive="assertive"
        labelPosition="left"
        size={SpinnerSize.large}
      />
    );

    const uploadOptions = [
      {
        key: "local",
        text: "",
        onRenderField: (props?: IChoiceGroupOption, render?: IRenderFunction<IChoiceGroupOption>) => {
          return (
            <Stack gap={10} horizontal={true} verticalAlign="baseline">
              {render!(props)}
              <Label>Upload from local disk</Label>
              <label className={styles.fileLabel}>
                <a className={cx({ fileBtn: true, fileDisabled: !(props && props.checked) })}>
                  Import
                </a>
                <input
                  type="file"
                  className={styles.fileInput}
                  accept=".yml,.yaml"
                  onChange={this.importFile}
                  disabled={props ? !props.checked : false}
                />
              </label>
            </Stack>
          );
        },
      },
      {
        key: "marketplace",
        text: "",
        onRenderField: (props?: IChoiceGroupOption, render?: IRenderFunction<IChoiceGroupOption>) => {
          const marketplaceCookie = Cookies.getJSON("marketplace");
          return (
            <Stack gap={10} horizontal={true} verticalAlign="baseline">
              {render!(props)}
              <Label>Select from marketplace</Label>
              <MarketplaceForm
                defaultURI={marketplaceCookie ? marketplaceCookie.uri : undefined}
                defaultURIType={marketplaceCookie ? marketplaceCookie.type : undefined}
                defaultURIToken={marketplaceCookie ? marketplaceCookie.token : undefined}
                defaultOption={this.state.marketplaceOption}
                onSelectProtocol={this.onSelectProtocol}
                disabled={props ? !props.checked : false}
              />
            </Stack>
          );
        },
      },
    ];

    return (
      <Fabric>
        <Panel
          isOpen={this.state.showEditor}
          isLightDismiss={true}
          onDismiss={this.closeEditor}
          type={PanelType.largeFixed}
          headerText="Protocol YAML Editor"
        >
          <Stack gap={20}>
            <Stack className={monacoStyles.monacoHack}>
              <Suspense fallback={editorSpinner}>
                <MonacoEditor
                  width={800}
                  height={800}
                  value={this.state.protocolYAML}
                  onChange={this.editProtocol}
                  language="yaml"
                  theme="vs-dark"
                  options={{ wordWrap: "on", readOnly: false }}
                />
              </Suspense>
            </Stack>
            <Stack gap={20} horizontal={true}>
              <PrimaryButton text="Save" onClick={this.saveEditor} />
              <DefaultButton text="Discard" onClick={this.discardEditor} />
            </Stack>
          </Stack>
        </Panel>

        <Stack>
          <Stack gap={20} padding={20} horizontalAlign="center" className={styles.form}>
            <Stack horizontal={true} horizontalAlign="center" className={styles.header}>
              <Text variant="xxLarge" nowrap={true} block={true} className={styles.title}>
                Submit Job v2 <span className={styles.subTitle}>Protocol Preview</span>
              </Text>
            </Stack>
            <Stack className={styles.fileItem}>
              <ChoiceGroup
                selectedKey={this.state.fileOption}
                options={uploadOptions}
                label="Upload Protocol YAML"
                onChange={this.changeFileOption}
                required={false}
              />
            </Stack>
            <Stack className={styles.item}>
              <TextField
                label="Job Name"
                value={this.state.jobName}
                onChange={this.setJobName}
                required={true}
              />
            </Stack>
            <Stack className={styles.item}>
              <Toggle
                label="Enable TensorBoard"
                checked={this.state.enableTensorBoard}
                onChange={this.toggleTensorBoard}
                inlineLabel={true}
              />
              {this.renderTensorBoardStorage()}
              {this.renderTensorBoardLogPath()}
            </Stack>
            <Stack className={styles.item}>
              <Toggle
                label="Job Parameters"
                checked={this.state.showParameters}
                onChange={this.toggleParameters}
                inlineLabel={true}
              />
              {this.renderParameters()}
            </Stack>
            <Stack gap={20} horizontal={true} horizontalAlign="end" className={styles.footer}>
              <PrimaryButton text="Submit Job" onClick={this.submitProtocol} />
              <DefaultButton text="Edit YAML" onClick={this.openEditor} />
            </Stack>
          </Stack>
        </Stack>
      </Fabric>
    );
  }

  private fetchConfig = async () => {
    let protocol = null;
    const source = this.props.source;
    const pluginId = this.props.pluginId;
    try {
      if (source && source.protocolYAML) {
        protocol = yaml.safeLoad(source.protocolYAML);
        this.setState({
          fileOption: "marketplace",
          marketplaceOption: source.protocolItemKey,
        });
      } else if (source && source.jobName && source.user && pluginId) {
        const res = await fetch(
          `${this.props.api}/api/v1/user/${source.user}/jobs/${source.jobName}/config`,
        );
        const body = await res.text();
        protocol = yaml.safeLoad(body);
        if (protocol.extras.submitFrom !== pluginId) {
          throw new Error(`Unknown plugin id ${protocol.extras.submitFrom}`);
        }
        protocol.name = this.getCloneJobName(source.jobName);
      }
      if (protocol) {
        this.setState({
          jobName: protocol.name,
          protocol,
          protocolYAML: yaml.safeDump(protocol),
        });
      }
    } catch (err) {
      alert(err.message);
    }
    this.setState({ loading: false });
  }

  private getCloneJobName = (jobName: string) => {
    const originalName = jobName.replace(/_clone_([a-z0-9]{8,})$/, "");
    const randomHash = Math.random().toString(36).slice(2, 10);
    return `${originalName}_clone_${randomHash}`;
  }

  private setJobName = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, jobName?: string) => {
    if (jobName !== undefined) {
      const protocol = update(this.state.protocol, {
        name: { $set: jobName },
      });
      this.setState({
        jobName,
        protocol,
        protocolYAML: yaml.safeDump(protocol),
      });
    }
  }

  private setLogPath = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, logPath?: string) => {
    if (logPath !== undefined) {
      if (logPath === "") {
        logPath = "$TB_ROOT";
      }
      this.setState({ logPath });
    }
  }

  private setHost = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, host?: string) => {
    if (host !== undefined) {
      const externalStorage = this.state.externalStorage;
      externalStorage.host = host;
      this.setState({ externalStorage });
    }
  }

  private setRemotePath = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, remotePath?: string) => {
    if (remotePath !== undefined) {
      const externalStorage = this.state.externalStorage;
      externalStorage.remotePath = remotePath;
      this.setState({ externalStorage });
    }
  }

  private setType = (event: React.FormEvent<IComboBox>, option?: IComboBoxOption, index?: number, value?: string) => {
    if (option !== undefined) {
      const externalStorage = this.state.externalStorage;
      externalStorage.type = option.key.toString();
      this.setState({ externalStorage });
    }
  }

  private onSelectProtocol = (text: string) => {
    try {
      const protocol = yaml.safeLoad(text);
      this.setState({
        jobName: protocol.name || "",
        protocol,
        protocolYAML: text,
      });
    } catch (err) {
      alert(err.message);
    }
  }

  private importFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    const files = event.target.files;
    if (!files || !files[0]) {
      return;
    }
    const fileReader = new FileReader();
    fileReader.addEventListener("load", () => {
      const text = fileReader.result as string;
      try {
        const protocol = yaml.safeLoad(text);
        this.setState({
          jobName: protocol.name || "",
          protocol,
          protocolYAML: text,
        });
      } catch (err) {
        alert(err.message);
      }
    });
    fileReader.readAsText(files[0]);
  }

  private changeFileOption = (event?: React.FormEvent<HTMLElement>, option?: IChoiceGroupOption) => {
    if (option && option.key) {
      this.setState({ fileOption: option.key });
    }
  }

  private getParameterItems = () => {
    const pairs: IParameterItem[] = [];
    const parameters = this.state.protocol.parameters as object;
    if (parameters) {
      Object.entries(parameters).forEach(
        ([key, value]) => pairs.push({ key, value }),
      );
    }
    return pairs;
  }

  private renderParameterItems = (item?: IParameterItem) => {
    if (item !== undefined) {
      const setParameter = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, value?: string) => {
        if (value !== undefined) {
          const protocol = this.state.protocol;
          (protocol.parameters as IParameterObj)[item.key] = value;
          this.setState({
            protocol,
            protocolYAML: yaml.safeDump(protocol),
          });
        }
      };

      return (
        <TextField
          label={`${item.key}: `}
          defaultValue={item.value}
          onChange={setParameter}
        />
      );
    } else {
      return (null);
    }
  }

  private toggleTensorBoard = (event: React.MouseEvent<HTMLElement, MouseEvent>, checked?: boolean) => {
    if (checked !== undefined) {
      this.setState({ enableTensorBoard: checked });
    }
  }

  private toggleParameters = (event: React.MouseEvent<HTMLElement, MouseEvent>, checked?: boolean) => {
    if (checked !== undefined) {
      this.setState({ showParameters: checked });
    }
  }

  private renderTensorBoardStorage = () => {
    if (this.state.enableTensorBoard) {
      return (
        <div>
          <ComboBox
            label="Storage Type"
            onChange={this.setType}
            options={externalStorageTypeOptions}
          />
          {this.renderTensorBoardStorageParameters()}
        </div>
      );
    }
  }

  private renderTensorBoardStorageParameters = () => {
    switch (this.state.externalStorage.type) {
      case 'hdfs':
        return (
          <div>
            <TextField
              label="Host IP: Port"
              placeholder={`${this.props.api.split("//")[1].split(":")[0]}:9000`}
              value={this.state.externalStorage.host}
              onChange={this.setHost}
            />
            <TextField
              label="Remote Path"
              value={this.state.externalStorage.remotePath}
              onChange={this.setRemotePath}
              required={true}
            />
          </div>
        );
        break;
      case 'nfs':
        return (
          <div>
            <TextField
              label="Host IP"
              value={this.state.externalStorage.host}
              onChange={this.setHost}
              required={true}
            />
            <TextField
              label="Remote Path"
              value={this.state.externalStorage.remotePath}
              onChange={this.setRemotePath}
              required={true}
            />
          </div>
        );
        break;
    }
  }

  private renderTensorBoardLogPath = () => {
    if (this.state.enableTensorBoard) {
      return (
        <TextField
          label="Log Path"
          value={this.state.logPath}
          onChange={this.setLogPath}
          required={true}
        />
      );
    }
  }

  private renderParameters = () => {
    if (this.state.showParameters) {
      const items = this.getParameterItems();
      if (items.length > 0) {
        return (
          <List
            items={this.getParameterItems()}
            onRenderCell={this.renderParameterItems}
          />
        );
      } else {
        return (
          <Label>There is no parameter to show.</Label>
        );
      }
    } else {
      return (null);
    }
  }

  private editProtocol = (text: string) => {
    this.setState({ protocolYAML: text });
  }

  private openEditor = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    this.setState({ showEditor: true });
  }

  private closeEditor = () => {
    this.setState({ showEditor: false });
  }

  private saveEditor = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    const text = this.state.protocolYAML;
    try {
      const protocol = yaml.safeLoad(text);
      this.setState({
        jobName: protocol.name || "",
        protocol,
        showEditor: false,
      });
    } catch (err) {
      alert(err.message);
    }
  }

  private discardEditor = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    const text = yaml.safeDump(this.state.protocol);
    this.setState({
      protocolYAML: text,
      showEditor: false,
    });
  }

  private generatePreCommand = async () => {
    let preCommand = [];
    let mountPath = "/TMP_TENSORBOARD_LOG";
    const storageConfig = this.state.externalStorage;
    preCommand.push(
      `if [ ! -d ${mountPath} ]; then mkdir --parents ${
      mountPath
      }; fi`,
    );
    preCommand.push("apt-get update")
    switch (storageConfig.type) {
      case "hdfs":
        preCommand.push([
          "apt-get install -y git fuse golang",
          "git clone --recursive https://github.com/Microsoft/hdfs-mount.git",
          "cd hdfs-mount",
          "make",
          "cp hdfs-mount /bin",
          "cd ..",
          "rm -rf hdfs-mount",
        ].join("&&"));
        if (storageConfig.host === undefined || storageConfig.remotePath === undefined) {
          preCommand = [];
          break;
        }
        preCommand.push(`(hdfs-mount ${storageConfig.host} ${mountPath} &)`);
        preCommand.push(`sleep 5`);
        mountPath += storageConfig.remotePath;
        break;
      case "nfs":
        if (storageConfig.host === undefined || storageConfig.remotePath === undefined) {
          preCommand = [];
          break;
        } preCommand.push("apt-get install -y nfs-common")
        preCommand.push(`mount -t nfs4 ${storageConfig.host}:${storageConfig.remotePath} ${mountPath}`);
        break;
      default:
        preCommand = [];
        break;
    }
    if (preCommand.length === 0) {
      alert("Please complete the storage config!");
      return [];
    }
    preCommand.push(`export TB_ROOT=${mountPath}`);
    return preCommand;
  }

  private injectCommand = async () => {
    const preCommand = await this.generatePreCommand();
    if (preCommand.length === 0) {
      return false;
    }
    const protocol = yaml.safeLoad(this.state.protocolYAML);
    if (protocol.hasOwnProperty("taskRoles")) {
      const obj = protocol.taskRoles;
      Object.keys(obj).forEach((key) => {
        obj[key].commands = preCommand.concat(obj[key].commands);
      });
    }
    this.setState({
      protocol,
      protocolYAML: yaml.safeDump(protocol),
    });
  }

  private addTensorBoardConfig = async () => {
    const protocol = yaml.safeLoad(this.state.protocolYAML);
    const randomStr = Math.random().toString(36).slice(-8);
    const tensorBoardName = `TensorBoard_${randomStr}`;
    const tensorBoardImage = `tensorBoardImage_${randomStr}`;
    const tensorBoardPort = `tensorBoardPort_${randomStr}`;
    let length = 0;
    if (protocol.hasOwnProperty("prerequisites")) {
      length = protocol.prerequisites.length;
    } else {
      protocol.prerequisites = [];
    }
    protocol.prerequisites[length] = {
      protocolVersion: 2,
      name: tensorBoardImage,
      type: "dockerimage",
      version: "1.0 - r1.4",
      contributor: "OpenPAI",
      uri: "openpai/pai.example.tensorflow",
    };
    const portList = ` --port=$PAI_CONTAINER_HOST_${tensorBoardPort}_PORT_LIST`;
    protocol.taskRoles[tensorBoardName] = {
      instances: 1,
      completion: {
        minFailedInstances: 1,
        minSucceededInstances: null,
      },
      taskRetryCount: 0,
      dockerImage: tensorBoardImage,
      resourcePerInstance:
      {
        cpu: 4,
        memoryMB: 8192,
        gpu: 0,
        ports: {},
      },
      commands: [`tensorboard --logdir=${this.state.logPath} ${portList}`],
    };
    protocol.taskRoles[tensorBoardName].resourcePerInstance.ports[tensorBoardPort] = 1;
    protocol.extras = { tensorBoardStr: randomStr };
    this.setState({
      protocol,
      protocolYAML: yaml.safeDump(protocol),
    });
  }

  private submitProtocol = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    if (!this.state.protocolYAML) {
      return;
    }
    const protocolBackup = this.state.protocol;
    if (this.state.enableTensorBoard) {
      if (this.state.logPath === "") {
        alert("Please input the tensorboard log path!");
        return;
      } else {
        await this.addTensorBoardConfig();
        const ret = await this.injectCommand();
        if (ret === false) {
          return;
        }
      }
    }
    const protocol = yaml.safeLoad(this.state.protocolYAML);
    if (protocol.hasOwnProperty("extras")) {
      protocol.extras.submitFrom = this.props.pluginId;
    } else {
      protocol.extras = { submitFrom: this.props.pluginId };
    }

    try {
      const res = await fetch(`${this.props.api}/api/v2/jobs`, {
        body: yaml.safeDump(protocol),
        headers: {
          "Authorization": `Bearer ${this.props.token}`,
          "Content-Type": "text/yaml",
        },
        method: "POST",
      });
      const body = await res.json();
      if (Number(res.status) >= 400) {
        this.state.protocol = protocolBackup;
        this.state.protocolYAML = yaml.safeDump(protocolBackup);
        alert(body.message);
      } else {
        window.location.href = `/job-detail.html?username=${this.props.user}&jobName=${this.state.jobName}`;
      }
    } catch (err) {
      this.state.protocol = protocolBackup;
      this.state.protocolYAML = yaml.safeDump(protocolBackup);
      alert(err.message);
    }
  }
}
