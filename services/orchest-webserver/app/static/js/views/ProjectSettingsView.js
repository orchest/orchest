import React from "react";
import ProjectsView from "./ProjectsView";
import { makeRequest, makeCancelable, PromiseManager } from "../lib/utils/all";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import EnvVarList from "../components/EnvVarList";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
} from "../utils/webserver-utils";

class ProjectSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      unsavedChanges: false,
    };

    this.promiseManager = new PromiseManager();
    this.overflowListener = new OverflowListener();

    this.handleChange = this.handleChange.bind(this);
    this.onDelete = this.onDelete.bind(this);
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchSettings();
    this.attachResizeListener();
  }

  componentDidUpdate() {
    this.attachResizeListener();
  }

  attachResizeListener() {
    this.overflowListener.attach();
  }

  fetchSettings() {
    let projectPromise = makeCancelable(
      makeRequest("GET", "/async/projects/" + this.props.project_uuid),
      this.promiseManager
    );

    projectPromise.promise.then((response) => {
      let result = JSON.parse(response);

      this.setState({
        envVariables: envVariablesDictToArray(result["env_variables"]),
        projectName: result["path"],
      });
    });
  }

  closeSettings() {
    orchest.loadView(ProjectsView);
  }

  saveGeneralForm(e) {
    e.preventDefault();

    let envVariables = envVariablesArrayToDict(this.state.envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariables === undefined) {
      return;
    }

    // perform PUT to update
    makeRequest("PUT", "/async/projects/" + this.props.project_uuid, {
      type: "json",
      content: { env_variables: envVariables },
    })
      .then(() => {
        this.setState({
          unsavedChanges: false,
        });
      })
      .catch((response) => {
        console.error(response);
      });
  }

  handleChange(value, idx, type) {
    const envVariables = this.state.envVariables.slice();
    envVariables[idx][type] = value;

    this.setState({
      unsavedChanges: true,
      envVariables: envVariables,
    });
  }

  addEnvPair(e) {
    e.preventDefault();

    const envVariables = this.state.envVariables.slice();
    this.setState({
      envVariables: envVariables.concat([
        {
          name: null,
          value: null,
        },
      ]),
    });
  }

  onDelete(idx) {
    const envVariables = this.state.envVariables.slice();
    envVariables.splice(idx, 1);
    this.setState({
      envVariables: envVariables,
      unsavedChanges: true,
    });
  }

  render() {
    return (
      <div className={"view-page view-project-settings"}>
        <form
          className="project-settings-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <h2>Project settings</h2>
          {(() => {
            if (this.state.envVariables) {
              return (
                <>
                  <div className="project-settings trigger-overflow">
                    <div className="push-down top-labels">
                      <label>Project</label>
                      <h3>{this.state.projectName}</h3>
                    </div>

                    <h3 className="push-down">Project environment variables</h3>

                    <EnvVarList
                      value={this.state.envVariables}
                      onChange={(e, idx, type) =>
                        this.handleChange(e, idx, type)
                      }
                      onDelete={(idx) => this.onDelete(idx)}
                      readOnly={false}
                      onAdd={this.addEnvPair.bind(this)}
                    />
                  </div>
                  <div className="bottom-buttons observe-overflow">
                    <MDCButtonReact
                      label={this.state.unsavedChanges ? "SAVE*" : "SAVE"}
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      onClick={this.saveGeneralForm.bind(this)}
                      icon="save"
                    />
                  </div>
                </>
              );
            } else {
              return <MDCLinearProgressReact />;
            }
          })()}

          <div className="top-buttons">
            <MDCButtonReact
              classNames={["close-button"]}
              icon="close"
              onClick={this.closeSettings.bind(this)}
            />
          </div>
        </form>
      </div>
    );
  }
}

export default ProjectSettingsView;
