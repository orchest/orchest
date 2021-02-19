import React, { Fragment } from "react";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
  LANGUAGE_MAP,
} from "../lib/utils/all";
import EnvironmentEditView from "../views/EnvironmentEditView";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCDataTableReact from "../lib/mdc-components/MDCDataTableReact";

class EnvironmentList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      environments: undefined,
      environmentBuilds: {},
    };

    this.BUILD_POLL_FREQUENCY = 3000;

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.fetchEnvironments();
    this.environmentBuildsPolling();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
    clearInterval(this.environmentBuildsInterval);
  }

  environmentBuildsPolling() {
    this.environmentBuildsRequest();
    clearInterval(this.environmentBuildsInterval);
    this.environmentBuildsInterval = setInterval(
      this.environmentBuildsRequest.bind(this),
      this.BUILD_POLL_FREQUENCY
    );
  }

  environmentBuildsRequest() {
    let environmentBuildsRequestPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/environment-builds/most-recent/${this.props.project_uuid}`
      ),
      this.promiseManager
    );

    environmentBuildsRequestPromise.promise
      .then((response) => {
        try {
          let environmentBuilds = JSON.parse(response).environment_builds;
          this.updateStateForEnvironmentBuilds(environmentBuilds);
        } catch (error) {
          console.error(error);
        }
      })
      .catch((error) => {
        console.log(error);
      });
  }

  updateStateForEnvironmentBuilds(environmentBuilds) {
    this.state.environmentBuilds = {};
    for (let environmentBuild of environmentBuilds) {
      this.state.environmentBuilds[
        environmentBuild.project_uuid + "-" + environmentBuild.environment_uuid
      ] = environmentBuild;
    }

    this.setState({
      environmentBuilds: this.state.environmentBuilds,
      listData: this.processListData(this.state.environments),
    });
  }

  fetchEnvironments() {
    // fetch data sources
    let environmentsPromise = makeCancelable(
      makeRequest("GET", `/store/environments/` + this.props.project_uuid),
      this.promiseManager
    );

    environmentsPromise.promise
      .then((result) => {
        try {
          let environments = JSON.parse(result);

          this.setState({
            environments: environments,
            listData: this.processListData(environments),
          });

          // in case environmentListView exists, clear checks
          if (this.refManager.refs.environmentListView) {
            this.refManager.refs.environmentListView.setSelectedRowIds([]);
          }
        } catch (error) {
          console.log(error);
          console.log("Error parsing JSON response: ", result);
        }
      })
      .catch((err) => {
        console.log("Error fetching Environments", err);
      });
  }

  onClickListItem(row, idx, e) {
    let environment = this.state.environments[idx];
    orchest.loadView(EnvironmentEditView, {
      queryArgs: {
        project_uuid: this.props.project_uuid,
        environment_uuid: environment.uuid,
      },
    });
  }

  onCreateClick() {
    orchest.loadView(EnvironmentEditView, {
      queryArgs: {
        project_uuid: this.props.project_uuid,
      },
    });
  }

  _removeEnvironment(project_uuid, environment_uuid, environmentName) {
    // ultimately remove Image
    makeRequest(
      "DELETE",
      `/store/environments/${project_uuid}/${environment_uuid}`
    )
      .then((_) => {
        // reload list once removal succeeds
        this.fetchEnvironments();
      })
      .catch((e) => {
        let errorMessage = "unknown";
        try {
          errorMessage = JSON.parse(e.body).message;
        } catch (e) {
          console.error(e);
        }
        orchest.alert(
          "Error",
          "Deleting environment '" +
            environmentName +
            "' failed. " +
            errorMessage
        );
      });
  }

  removeEnvironment(project_uuid, environment_uuid, environmentName) {
    // validate if environment is in use, if it is, prompt user
    // specifically on remove

    makeRequest(
      "GET",
      `/catch/api-proxy/api/environment-images/in-use/${project_uuid}/${environment_uuid}`
    ).then((response) => {
      let data = JSON.parse(response);
      if (data.in_use) {
        orchest.confirm(
          "Warning",
          "The environment you're trying to delete (" +
            environmentName +
            ") is in use. " +
            "Are you sure you want to delete it? This will abort all jobs/interactive runs that are using it.",
          () => {
            this._removeEnvironment(
              project_uuid,
              environment_uuid,
              environmentName
            );
          }
        );
      } else {
        this._removeEnvironment(
          project_uuid,
          environment_uuid,
          environmentName
        );
      }
    });
  }

  onDeleteClick() {
    let selectedIndices = this.refManager.refs.environmentListView.getSelectedRowIndices();

    if (selectedIndices.length === 0) {
      orchest.alert("Error", "You haven't selected any environments.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you certain that you want to delete the selected environments?",
      () => {
        selectedIndices.forEach((idx) => {
          let environment_uuid = this.state.environments[idx].uuid;
          let project_uuid = this.state.environments[idx].project_uuid;
          this.removeEnvironment(
            project_uuid,
            environment_uuid,
            this.state.environments[idx].name
          );
        });
      }
    );
  }

  processListData(environments) {
    let listData = [];

    // check for undefined environments
    if (!environments) {
      return listData;
    }

    for (let environment of environments) {
      let environmentBuild = this.state.environmentBuilds[
        this.props.project_uuid + "-" + environment.uuid
      ];

      listData.push([
        <span>{environment.name}</span>,
        <span>{LANGUAGE_MAP[environment.language]}</span>,
        <span>
          {environment.gpu_support ? (
            <i className="material-icons lens-button">lens</i>
          ) : (
            <i className="material-icons disabled lens-button">lens</i>
          )}
        </span>,
        <span>{environmentBuild ? environmentBuild.status : ""}</span>,
      ]);
    }
    return listData;
  }

  render() {
    return (
      <div className={"environments-page"}>
        <h2>Environments</h2>

        {(() => {
          if (this.state.environments) {
            return (
              <Fragment>
                <div className={"environment-actions push-down"}>
                  <MDCIconButtonToggleReact
                    icon="add"
                    tooltipText="Add environment"
                    onClick={this.onCreateClick.bind(this)}
                  />
                  <MDCIconButtonToggleReact
                    icon="delete"
                    tooltipText="Delete environment"
                    onClick={this.onDeleteClick.bind(this)}
                  />
                </div>

                <MDCDataTableReact
                  ref={this.refManager.nrefs.environmentListView}
                  selectable
                  onRowClick={this.onClickListItem.bind(this)}
                  classNames={["fullwidth"]}
                  headers={[
                    "Environment",
                    "Language",
                    "GPU Support",
                    "Build status",
                  ]}
                  rows={this.state.listData}
                />
              </Fragment>
            );
          } else {
            return <MDCLinearProgressReact />;
          }
        })()}
      </div>
    );
  }
}

export default EnvironmentList;
