import React from "react";
import ProjectsView from "./ProjectsView";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
} from "@orchest/lib-utils";
import { MDCButtonReact, MDCLinearProgressReact } from "@orchest/lib-mdc";
import { OrchestContext } from "@/hooks/orchest";
import EnvVarList from "../components/EnvVarList";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  OverflowListener,
  updateGlobalUnsavedChanges,
} from "../utils/webserver-utils";
import PipelinesView from "./PipelinesView";
import JobsView from "./JobsView";
import EnvironmentsView from "./EnvironmentsView";

class ProjectSettingsView extends React.Component {
  static contextType = OrchestContext;

  constructor(props, context) {
    super(props, context);

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
      makeRequest(
        "GET",
        "/async/projects/" + this.props.queryArgs.project_uuid
      ),
      this.promiseManager
    );

    projectPromise.promise.then((response) => {
      let result = JSON.parse(response);

      this.setState({
        envVariables: envVariablesDictToArray(result["env_variables"]),
        pipeline_count: result["pipeline_count"],
        job_count: result["job_count"],
        environment_count: result["environment_count"],
        projectName: result["path"],
      });
    });
  }

  returnToProjects() {
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
    makeRequest("PUT", "/async/projects/" + this.props.queryArgs.project_uuid, {
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

  onClickProjectEntity(view, projectUUID, e) {
    e.preventDefault();
    this.context.dispatch({
      type: "projectSet",
      payload: projectUUID,
    });
    orchest.loadView(view);
  }

  render() {
    updateGlobalUnsavedChanges(this.state.unsavedChanges);
    return (
      <div className={"view-page view-project-settings"}>
        <form
          className="project-settings-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="push-down">
            <MDCButtonReact
              label="Back to projects"
              icon="arrow_back"
              onClick={this.returnToProjects.bind(this)}
            />
          </div>

          <h2>Project settings</h2>
          {(() => {
            if (this.state.envVariables) {
              return (
                <>
                  <div className="project-settings trigger-overflow">
                    <div className="columns four push-down top-labels">
                      <div className="column">
                        <label>Project</label>
                        <h3>{this.state.projectName}</h3>
                      </div>
                      <div className="column">
                        <br />
                        <h3>
                          <button
                            className="text-button"
                            onClick={this.onClickProjectEntity.bind(
                              this,
                              PipelinesView,
                              this.props.queryArgs.project_uuid
                            )}
                          >
                            {this.state.pipeline_count +
                              " " +
                              (this.state.pipeline_count == 1
                                ? "pipeline"
                                : "pipelines")}
                          </button>
                        </h3>
                      </div>
                      <div className="column">
                        <br />
                        <h3>
                          <button
                            className="text-button"
                            onClick={this.onClickProjectEntity.bind(
                              this,
                              JobsView,
                              this.props.queryArgs.project_uuid
                            )}
                          >
                            {this.state.job_count +
                              " " +
                              (this.state.job_count == 1 ? "job" : "jobs")}
                          </button>
                        </h3>
                      </div>
                      <div className="column">
                        <br />
                        <h3>
                          <button
                            className="text-button"
                            onClick={this.onClickProjectEntity.bind(
                              this,
                              EnvironmentsView,
                              this.props.queryArgs.project_uuid
                            )}
                          >
                            {this.state.environment_count +
                              " " +
                              (this.state.environment_count == 1
                                ? "environment"
                                : "environments")}
                          </button>
                        </h3>
                      </div>
                      <div className="clear"></div>
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
        </form>
      </div>
    );
  }
}

export default ProjectSettingsView;
