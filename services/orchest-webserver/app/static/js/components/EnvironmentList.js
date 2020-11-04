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
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.fetchEnvironments();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
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
    orchest.loadView(EnvironmentEditView, { project_uuid: this.props.project_uuid, environment: environment });
  }

  onCreateClick() {
    orchest.loadView(EnvironmentEditView, { project_uuid: this.props.project_uuid });
  }

  removeEnvironment(project_uuid, environment_uuid) {
    // ultimately remove Image
    makeRequest("DELETE", `/store/environments/${project_uuid}/${environment_uuid}`)
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
          "Deleting environment '" +
            this.state.environments[idx].name +
            "' failed. Reason: " +
            errorMessage
        );
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
          this.removeEnvironment(project_uuid, environment_uuid);
        });
      }
    );
  }

  processListData(environments) {
    let listData = [];

    for (let environment of environments) {
      listData.push([
        <span>{environment.name}</span>,
        <span>{LANGUAGE_MAP[environment.language]}</span>,
        <span>
          {environment.gpu_support ? (
            <i className="material-icons">done</i>
          ) : (
            <i className="material-icons mdc-button__icon">clear</i>
          )}
        </span>,
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
                    onClick={this.onCreateClick.bind(this)}
                  />
                  <MDCIconButtonToggleReact
                    icon="delete"
                    onClick={this.onDeleteClick.bind(this)}
                  />
                </div>

                <MDCDataTableReact
                  ref={this.refManager.nrefs.environmentListView}
                  selectable
                  onRowClick={this.onClickListItem.bind(this)}
                  classNames={["fullwidth"]}
                  headers={["Environment", "Language", "GPU Support"]}
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
