import React from "react";
import ProjectsView from "./ProjectsView";
import { makeRequest, PromiseManager, makeCancelable } from "../lib/utils/all";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import EnvVarList from "../components/EnvVarList";

class ProjectSettingsView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      unsavedChanges: false,
    };

    this.promiseManager = new PromiseManager();
    this.handleChange = this.handleChange.bind(this);
    this.onDelete = this.onDelete.bind(this);
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchSettings();
  }

  fetchSettings() {
    let projectPromise = makeCancelable(
      makeRequest("GET", "/async/projects/" + this.props.project_uuid),
      this.promiseManager
    );

    projectPromise.promise.then((response) => {
      let result = JSON.parse(response);

      const tmp = result["env_variables"];
      const envVariables = new Array(tmp.length).fill(null);
      Object.keys(tmp).map((name, idx) => {
        envVariables[idx] = { name: name, value: tmp[name] };
      });

      this.setState({
        envVariables: envVariables,
        projectName: result["path"],
      });
    });
  }

  closeSettings() {
    orchest.loadView(ProjectsView);
  }

  saveGeneralForm(e) {
    e.preventDefault();

    // Make into object again and check for duplicate keys.
    const envVariables = {};
    const seen = new Set();
    for (const pair of this.state.envVariables) {
      if (!pair) {
        continue;
      } else if (!pair["name"] || !pair["value"]) {
        orchest.alert(
          "Error",
          "Environment variables must have a name and value."
        );
        break;
      } else if (seen.has(pair["name"])) {
        orchest.alert(
          "Error",
          "You have defined environment variables with the same name."
        );
        break;
      } else {
        envVariables[pair["name"]] = pair["value"];
        seen.add(pair["name"]);
      }
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
        <h2>Project settings</h2>

        {(() => {
          if (this.state.envVariables) {
            return (
              <div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div>
                    <div className="column push-down">
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
                    />
                    <MDCButtonReact
                      icon="add"
                      classNames={["mdc-button--raised push-right"]}
                      onClick={this.addEnvPair.bind(this)}
                    />
                    <MDCButtonReact
                      label={this.state.unsavedChanges ? "SAVE*" : "SAVE"}
                      classNames={["mdc-button--raised"]}
                      onClick={this.saveGeneralForm.bind(this)}
                    />
                  </div>
                </form>
              </div>
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
      </div>
    );
  }
}

export default ProjectSettingsView;
