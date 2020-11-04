import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { Controlled as CodeMirror } from "react-codemirror2";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCCheckboxReact from "../lib/mdc-components/MDCCheckboxReact";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
  LANGUAGE_MAP,
} from "../lib/utils/all";
import EnvironmentsView from "./EnvironmentsView";
import { XTerm } from "xterm-for-react";
import { FitAddon } from "xterm-addon-fit";

import io from "socket.io-client";

require("codemirror/mode/shell/shell");

class EnvironmentEditView extends React.Component {
  componentWillUnmount() {
    if (this.socket) {
      this.socket.close();
      console.log("SocketIO with namespace /pty disconnected.");
    }

    this.promiseManager.cancelCancelablePromises();
  }

  constructor(props) {
    super(props);

    this.state = {
      newEnvironment: props.environment === undefined,
      showingBuildLogs: false,
      environment: props.environment
        ? props.environment
        : {
            uuid: "new",
            name: "",
            gpu_support: false,
            building: false,
            project_uuid: this.props.project_uuid,
            base_image: "",
            language: "python",
            startup_script:
              `#!/bin/bash

# Install any dependencies you have in this shell script.

# E.g. pip install tensorflow


`,
          },
      building: props.environment ? props.environment.building : false,
    };

    this.state.gpuDocsNotice = this.state.environment.gpu_support;

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();

    // initialize Xterm addons
    this.fitAddon = new FitAddon();
  }

  componentDidMount() {
    this.connectSocketIO();
  }

  connectSocketIO() {
    // disable polling
    this.socket = io.connect("/pty", { transports: ["websocket"] });

    this.socket.on("connect", () => {
      console.log("SocketIO connected on /pty");
    });

    this.socket.on("pty-output", (data) => {
      // ignore terminal outputs from other environment_uuids
      if (data.environment_uuid == this.state.environment.uuid) {
        this.refManager.refs.term.terminal.write(data.output);
      }
    });

    this.socket.on("pty-signals", (data) => {
      if (
        data.environment_uuid == this.state.environment.uuid &&
        data.action == "build-ready"
      ) {
        this.setState({
          building: false,
        });
      }
    });
  }

  build(e) {
    this.setState({
      building: true,
    });

    e.nativeEvent.preventDefault();

    if(this.refManager.refs.term){
      this.refManager.refs.term.terminal.clear();
    }

    this.savePromise().then(() => {
      let method = "POST";
      let endpoint = `/catch/api-proxy/api/environment_builds/${this.state.environment.project_uuid}/${this.state.environment.uuid}`;

      makeRequest(method, endpoint, {
        type: "json",
        content: {},
      })
      .then((response) => {
        console.log(response)
      })
      .catch((error) => {
        console.log(error);
      });
    });
  }

  savePromise() {

    // Saving an environment will invalidate the Jupyter <iframe>
    // TODO: perhaps this can be fixed with coordination between JLab +
    // Enterprise Gateway team.
    orchest.jupyter.unload();

    return makeCancelable(
      new Promise((resolve, reject) => {
        let method = "POST";
        let endpoint = `/store/environments/${this.state.environment.project_uuid}/${this.state.environment.uuid}`;

        if (this.state.newEnvironment === false) {
          method = "PUT";
        }

        makeRequest(method, endpoint, {
          type: "json",
          content: {
            environment: this.state.environment
          },
        })
          .then((response) => {
            let result = JSON.parse(response);

            this.state.environment.uuid = result.uuid;

            this.setState({
              environment: this.state.environment,
              newEnvironment: false,
            });

            resolve();

          })
          .catch((error) => {
            console.log(error);

            try {
              console.error(JSON.parse(error.body)["message"]);
            } catch (error) {
              console.log(error);
              console.log("Couldn't get error message from response.");
            }

            reject();
          });
      }),
      this.promiseManager
    ).promise;
  }

  save(e) {
    e.preventDefault();

    this.savePromise().then(() => {
      orchest.loadView(EnvironmentsView, { project_uuid: this.state.environment.project_uuid });
    });
  }

  toggleBuildLog(e){
    e.preventDefault();

    this.setState((state, props) => {
      return {showingBuildLogs: !state.showingBuildLogs}
    });
  }

  onChangeName(value) {
    this.state.environment.name = value;
  }

  onChangeBaseImage(value) {
    this.state.environment.base_image = value;
  }

  onChangeLanguage(value) {
    this.state.environment.language = value;
  }

  onGPUChange(is_checked) {
    this.state.environment.gpu_support = is_checked;
    this.setState({
      gpuDocsNotice: is_checked,
    });
  }

  render() {
    return (
      <div className={"view-page edit-environment"}>

        <h2>Edit environment</h2>

        <form className="environment-form">

          {(() => {
            if (this.state.environment.uuid !== "new") {
              return (
                <span className="environment-uuid">{this.state.environment.uuid}</span>
              );
            }
          })()}

          <MDCTextFieldReact
            ref={this.refManager.nrefs.environmentName}
            classNames={["fullwidth", "push-down"]}
            label="Environment name"
            onChange={this.onChangeName.bind(this)}
            value={this.state.environment.name}
          />

          <MDCSelectReact
            value="python"
            label="Language"
            classNames={["fullwidth", "push-down"]}
            ref={this.refManager.nrefs.environmentLanguage}
            onChange={this.onChangeLanguage.bind(this)}
            options={[
              ["python", LANGUAGE_MAP["python"]],
              ["r", LANGUAGE_MAP["r"]],
            ]}
            value={this.state.environment.language}
          />
          <MDCCheckboxReact
            onChange={this.onGPUChange.bind(this)}
            label="GPU support"
            classNames={["push-down"]}
            value={this.state.environment.gpu_support}
            ref={this.refManager.nrefs.environmentGPUSupport}
          />

          {(() => {
            if (this.state.gpuDocsNotice === true) {
              return (
                <div className="docs-notice push-down">
                  Check out{" "}
                  <a
                    target="_blank"
                    href={
                      orchest.config["DOCS_ROOT"] +
                      "/en/latest/installation.html"
                    }
                  >
                    the documentation
                  </a>{" "}
                  to make sure Orchest is properly configured for
                  images with GPU support.
                </div>
              );
            }
          })()}

          <MDCTextFieldReact
            classNames={["fullwidth", "push-down"]}
            label="Base image"
            onChange={this.onChangeBaseImage.bind(this)}
            value={this.state.environment.base_image}
          />

          <CodeMirror
            value={this.state.environment.startup_script}
            options={{
              mode: "application/x-sh",
              theme: "default",
              lineNumbers: true,
              viewportMargin: Infinity,
            }}
            onBeforeChange={(editor, data, value) => {
              this.state.environment.startup_script = value;

              this.setState({
                environment: this.state.environment,
              });
            }}
          />

          <div>
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary", "push-up"]}
              onClick={this.toggleBuildLog.bind(this)}
              label="Toggle build log"
              icon="subject"
            />
            {(() => {
                if(this.state.showingBuildLogs){
                  return <div className="push-up"><XTerm
                      addons={[this.fitAddon]}
                      ref={this.refManager.nrefs.term}
                  /></div>
                }
              })()}
          </div>
          
          <div className="multi-button push-up">
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              onClick={this.save.bind(this)}
              label="Save"
              icon="save"
            />
            <MDCButtonReact
              disabled={this.state.building}
              classNames={["mdc-button--raised"]}
              onClick={this.build.bind(this)}
              label="Build"
              icon="memory"
            />
          </div>
        </form>
      </div>
    );
  }
}

export default EnvironmentEditView;
