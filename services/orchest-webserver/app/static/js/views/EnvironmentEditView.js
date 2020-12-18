import React, { Fragment } from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCCheckboxReact from "../lib/mdc-components/MDCCheckboxReact";
import MDCTabBarReact from "../lib/mdc-components/MDCTabBarReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
  LANGUAGE_MAP,
  DEFAULT_BASE_IMAGES,
} from "../lib/utils/all";
import EnvironmentsView from "./EnvironmentsView";
import EnvironmentEditBuildTab from "../components/EnvironmentEditBuildTab";
require("codemirror/mode/shell/shell");

class EnvironmentEditView extends React.Component {
  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  constructor(props) {
    super(props);

    this.state = {
      subviewIndex: 0,
      baseImages:
        props.environment &&
        DEFAULT_BASE_IMAGES.indexOf(props.environment.base_image) == -1
          ? DEFAULT_BASE_IMAGES.concat(props.environment.base_image)
          : [...DEFAULT_BASE_IMAGES],
      newEnvironment: props.environment === undefined,
      unsavedChanges: false,
      environment: props.environment
        ? props.environment
        : {
            uuid: "new",
            name: orchest.config.ENVIRONMENT_DEFAULTS.name,
            gpu_support: orchest.config.ENVIRONMENT_DEFAULTS.gpu_support,
            project_uuid: this.props.project_uuid,
            base_image: orchest.config.ENVIRONMENT_DEFAULTS.base_image,
            language: orchest.config.ENVIRONMENT_DEFAULTS.language,
            setup_script: orchest.config.ENVIRONMENT_DEFAULTS.setup_script,
          },
    };

    this.state.gpuDocsNotice = this.state.environment.gpu_support;

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  save() {
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
            environment: this.state.environment,
          },
        })
          .then((response) => {
            let result = JSON.parse(response);

            this.state.environment.uuid = result.uuid;

            this.setState({
              environment: this.state.environment,
              newEnvironment: false,
              unsavedChanges: false,
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

  onSave(e) {
    e.preventDefault();
    this.save();
  }

  returnToEnvironments() {
    orchest.loadView(EnvironmentsView, {
      project_uuid: this.props.project_uuid,
    });
  }

  onChangeName(value) {
    this.state.environment.name = value;
    this.setState({
      unsavedChanges: true,
      environment: this.state.environment,
    });
  }

  onChangeBaseImage(value) {
    this.state.environment.base_image = value;
    this.setState({
      unsavedChanges: true,
      environment: this.state.environment,
    });
  }

  onChangeLanguage(value) {
    this.state.environment.language = value;
    this.setState({
      unsavedChanges: true,
      environment: this.state.environment,
    });
  }

  onGPUChange(is_checked) {
    this.state.environment.gpu_support = is_checked;
    this.setState({
      unsavedChanges: true,
      gpuDocsNotice: is_checked,
    });
  }

  onCancelAddCustomBaseImageDialog() {
    this.refManager.refs.addCustomBaseImageDialog.close();
  }

  onCloseAddCustomBaseImageDialog() {
    this.setState({
      addCustomBaseImageDialog: undefined,
    });
  }

  submitAddCustomBaseImage() {
    let customBaseImageName = this.refManager.refs.customBaseImageTextField.mdc
      .value;

    this.state.environment.base_image = customBaseImageName;

    this.setState((state, _) => {
      return {
        baseImages:
          state.baseImages.indexOf(customBaseImageName) == -1
            ? state.baseImages.concat(customBaseImageName)
            : state.baseImages,
        environment: this.state.environment,
        unsavedChanges: true,
        addCustomBaseImageDialog: undefined,
      };
    });
  }

  onAddCustomBaseImage() {
    this.setState({
      addCustomBaseImageDialog: (
        <MDCDialogReact
          title="Add custom base image"
          ref={this.refManager.nrefs.addCustomBaseImageDialog}
          onClose={this.onCloseAddCustomBaseImageDialog.bind(this)}
          content={
            <div>
              <MDCTextFieldReact
                label="Base image name"
                ref={this.refManager.nrefs.customBaseImageTextField}
              />
            </div>
          }
          actions={
            <Fragment>
              <MDCButtonReact
                label="Add"
                icon="check"
                classNames={["mdc-button--raised"]}
                submitButton
                onClick={this.submitAddCustomBaseImage.bind(this)}
              />
              <MDCButtonReact
                classNames={["push-left"]}
                label="Cancel"
                onClick={this.onCancelAddCustomBaseImageDialog.bind(this)}
              />
            </Fragment>
          }
        />
      ),
    });
  }

  onSelectSubview(index) {
    this.setState({
      subviewIndex: index,
    });
  }

  render() {
    let subview;

    switch (this.state.subviewIndex) {
      case 0:
        subview = (
          <Fragment>
            {(() => {
              if (this.state.environment.uuid !== "new") {
                return (
                  <span className="environment-uuid">
                    Environment UUID: {this.state.environment.uuid}
                  </span>
                );
              }
            })()}
            <div className="columns inner-padded">
              <div className="column">
                <MDCTextFieldReact
                  classNames={["fullwidth", "push-down"]}
                  label="Environment name"
                  onChange={this.onChangeName.bind(this)}
                  value={this.state.environment.name}
                />

                <div className="select-button-columns">
                  <MDCSelectReact
                    ref={this.refManager.nrefs.environmentName}
                    classNames={["fullwidth"]}
                    label="Base image"
                    onChange={this.onChangeBaseImage.bind(this)}
                    value={this.state.environment.base_image}
                    options={this.state.baseImages.map((el) => [el])}
                  />
                  <MDCButtonReact
                    icon="add"
                    label="Custom image"
                    onClick={this.onAddCustomBaseImage.bind(this)}
                  />
                  <div className="clear"></div>
                </div>
                <div className="form-helper-text push-down">
                  The base image will be the starting point from which the
                  environment will be built.
                </div>

                <MDCSelectReact
                  value="python"
                  label="Language"
                  classNames={["fullwidth"]}
                  ref={this.refManager.nrefs.environmentLanguage}
                  onChange={this.onChangeLanguage.bind(this)}
                  options={[
                    ["python", LANGUAGE_MAP["python"]],
                    ["r", LANGUAGE_MAP["r"]],
                    ["julia", LANGUAGE_MAP["julia"]],
                  ]}
                  value={this.state.environment.language}
                />
                <div className="form-helper-text push-down">
                  The language determines for which kernel language this
                  environment can be used. This only affects pipeline steps that
                  point to a Notebook.
                </div>

                {(() => {
                  if (this.state.languageDocsNotice === true) {
                    return (
                      <div className="docs-notice push-down">
                        Language explanation
                      </div>
                    );
                  }
                })()}

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
                        <p className="push-down">
                          If enabled, the environment will request GPU
                          capabilities when in use.
                        </p>
                        <p>
                          Check out{" "}
                          <a
                            target="_blank"
                            href={
                              orchest.config.ORCHEST_WEB_URLS.readthedocs +
                              "/getting_started/installation.html#gpu-support"
                            }
                          >
                            the documentation
                          </a>{" "}
                          to make sure Orchest is properly configured for
                          environments with GPU support. In particular, make
                          sure the selected base image supports GPU pass
                          through.
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
              <div className="column">
                <h3>Environment set-up script</h3>
                <div className="form-helper-text push-down">
                  This will execute when you build the environment. Use it to
                  include your dependencies.
                </div>
                <CodeMirror
                  value={this.state.environment.setup_script}
                  options={{
                    mode: "application/x-sh",
                    theme: "jupyter",
                    lineNumbers: true,
                    viewportMargin: Infinity,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    this.state.environment.setup_script = value;

                    this.setState({
                      environment: this.state.environment,
                      unsavedChanges: true,
                    });
                  }}
                />
              </div>
              <div className="clear"></div>
            </div>

            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              onClick={this.onSave.bind(this)}
              label={this.state.unsavedChanges ? "Save*" : "Save"}
              icon="save"
            />
          </Fragment>
        );
        break;
      case 1:
        subview = (
          <EnvironmentEditBuildTab
            environment={this.state.environment}
            saveEnvironment={this.save.bind(this)}
          />
        );
    }

    return (
      <div className={"view-page edit-environment"}>
        {(() => {
          if (this.state.addCustomBaseImageDialog) {
            return this.state.addCustomBaseImageDialog;
          }
        })()}

        <div className="push-down">
          <MDCButtonReact
            label="Back to environments"
            icon="arrow_back"
            onClick={this.returnToEnvironments.bind(this)}
          />
        </div>

        <div className="push-down">
          <MDCTabBarReact
            ref={this.refManager.nrefs.tabBar}
            selectedIndex={this.state.subviewIndex}
            items={["Properties", "Build"]}
            icons={["tune", "memory"]}
            onChange={this.onSelectSubview.bind(this)}
          />
        </div>

        {subview}
      </div>
    );
  }
}

export default EnvironmentEditView;
