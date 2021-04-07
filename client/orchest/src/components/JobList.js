import React, { Fragment } from "react";
import {
  MDCButtonReact,
  MDCIconButtonToggleReact,
  MDCTextFieldReact,
  MDCSelectReact,
  MDCLinearProgressReact,
  MDCDialogReact,
} from "@lib/mdc";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "@lib/utils";
import SearchableTable from "./SearchableTable";
import EditJobView from "../views/EditJobView";

import JobView from "../views/JobView";
import { formatServerDateTime } from "../utils/webserver-utils";

class JobList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      createModal: false,
      createModelLoading: false,
      jobs: undefined,
      pipelines: undefined,
      jobsSearchMask: new Array(0).fill(1),
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    // retrieve pipelines once on component render
    let pipelinePromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${this.props.project_uuid}`),
      this.promiseManager
    );

    pipelinePromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.setState({
          pipelines: result.result,
        });
      })
      .catch((e) => {
        console.log(e);
      });

    // retrieve jobs
    this.fetchList();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {}

  fetchList() {
    // in case jobTable exists, clear checks
    if (this.refManager.refs.jobTable) {
      this.refManager.refs.jobTable.setSelectedRowIds([]);
    }

    let fetchListPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/jobs/?project_uuid=${this.props.project_uuid}`
      ),
      this.promiseManager
    );

    fetchListPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.setState({
          jobs: result["jobs"],
          jobsSearchMask: new Array(result.length).fill(1),
        });
      })
      .catch((e) => {
        console.log(e);
      });
  }

  componentWillUnmount() {}

  onCreateClick() {
    if (this.state.pipelines !== undefined && this.state.pipelines.length > 0) {
      this.setState({
        createModal: true,
      });
    } else {
      orchest.alert("Error", "Could not find any pipelines for this project.");
    }
  }

  onDeleteClick() {
    // get job selection
    let selectedRows = this.refManager.refs.jobTable.getSelectedRowIndices();

    if (selectedRows.length == 0) {
      orchest.alert("Error", "You haven't selected any jobs.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you sure you want to delete these jobs? (This cannot be undone.)",
      () => {
        // delete indices
        let promises = [];

        for (let x = 0; x < selectedRows.length; x++) {
          promises.push(
            // deleting the job will also
            // take care of aborting it if necessary
            makeRequest(
              "DELETE",
              "/catch/api-proxy/api/jobs/cleanup/" +
                this.state.jobs[selectedRows[x]].uuid
            )
          );
        }

        Promise.all(promises).then(() => {
          this.fetchList();

          this.refManager.refs.jobTable.setSelectedRowIds([]);
        });
      }
    );
  }

  onSubmitModal() {
    let pipeline_uuid = this.refManager.refs.formPipeline.mdc.value;
    let pipelineName;
    for (let x = 0; x < this.state.pipelines.length; x++) {
      if (this.state.pipelines[x].uuid === pipeline_uuid) {
        pipelineName = this.state.pipelines[x].name;
        break;
      }
    }

    if (this.refManager.refs.formJobName.mdc.value.length == 0) {
      orchest.alert("Error", "Please enter a name for your job.");
      return;
    }

    if (this.refManager.refs.formPipeline.mdc.value == "") {
      orchest.alert("Error", "Please choose a pipeline.");
      return;
    }

    // TODO: in this part of the flow copy the pipeline directory to make
    // sure the pipeline no longer changes
    this.setState({
      createModelLoading: true,
    });

    let postJobPromise = makeCancelable(
      makeRequest("POST", "/catch/api-proxy/api/jobs/", {
        type: "json",
        content: {
          pipeline_uuid: pipeline_uuid,
          pipeline_name: pipelineName,
          project_uuid: this.props.project_uuid,
          name: this.refManager.refs.formJobName.mdc.value,
          draft: true,
          pipeline_run_spec: {
            run_type: "full",
            uuids: [],
          },
          parameters: [],
        },
      }),
      this.promiseManager
    );

    postJobPromise.promise
      .then((response) => {
        let job = JSON.parse(response);

        orchest.loadView(EditJobView, {
          queryArgs: {
            job_uuid: job.uuid,
          },
        });
      })
      .catch((response) => {
        if (!response.isCanceled) {
          try {
            let result = JSON.parse(response.body);
            orchest.alert("Error", "Failed to create job. " + result.message);

            this.setState({
              createModelLoading: false,
            });
          } catch (error) {
            console.log(error);
          }
        }
      });
  }
  onCancelModal() {
    this.refManager.refs.createJobDialog.close();
  }

  onCloseCreateJobModal() {
    this.setState({
      createModal: false,
    });
  }

  onRowClick(row, idx, event) {
    let job = this.state.jobs[idx];

    if (job.status === "DRAFT") {
      orchest.loadView(EditJobView, {
        queryArgs: {
          job_uuid: job.uuid,
        },
      });
    } else {
      orchest.loadView(JobView, {
        queryArgs: {
          job_uuid: job.uuid,
        },
      });
    }
  }

  jobListToTableData(jobs) {
    let rows = [];
    for (let x = 0; x < jobs.length; x++) {
      // keep only jobs that are related to a project!
      rows.push([
        jobs[x].name,
        jobs[x].pipeline_name,
        formatServerDateTime(jobs[x].created_time),
        jobs[x].status,
      ]);
    }
    return rows;
  }

  generatePipelineOptions(pipelines) {
    let pipelineOptions = [];

    for (let x = 0; x < pipelines.length; x++) {
      pipelineOptions.push([pipelines[x].uuid, pipelines[x].name]);
    }

    return pipelineOptions;
  }

  render() {
    return (
      <div className={"jobs-page"}>
        <h2>Jobs</h2>

        {(() => {
          if (this.state.jobs && this.state.pipelines) {
            return (
              <Fragment>
                {(() => {
                  if (this.state.createModal) {
                    let pipelineOptions = this.generatePipelineOptions(
                      this.state.pipelines
                    );

                    return (
                      <MDCDialogReact
                        title="Create a new job"
                        ref={this.refManager.nrefs.createJobDialog}
                        onClose={this.onCloseCreateJobModal.bind(this)}
                        content={
                          <Fragment>
                            <div className="create-job-modal">
                              <MDCTextFieldReact
                                ref={this.refManager.nrefs.formJobName}
                                classNames={["fullwidth push-down"]}
                                label="Job name"
                              />

                              <MDCSelectReact
                                ref={this.refManager.nrefs.formPipeline}
                                label="Pipeline"
                                classNames={["fullwidth"]}
                                value={pipelineOptions[0][0]}
                                options={pipelineOptions}
                              />

                              {(() => {
                                if (this.state.createModelLoading) {
                                  return (
                                    <Fragment>
                                      <MDCLinearProgressReact />
                                      <p>Copying pipeline directory...</p>
                                    </Fragment>
                                  );
                                }
                              })()}
                            </div>
                          </Fragment>
                        }
                        actions={
                          <Fragment>
                            <MDCButtonReact
                              icon="close"
                              classNames={["push-right"]}
                              label="Cancel"
                              onClick={this.onCancelModal.bind(this)}
                            />
                            <MDCButtonReact
                              disabled={this.state.createModelLoading}
                              icon="add"
                              classNames={[
                                "mdc-button--raised",
                                "themed-secondary",
                              ]}
                              label="Create job"
                              submitButton
                              onClick={this.onSubmitModal.bind(this)}
                            />
                          </Fragment>
                        }
                      />
                    );
                  }
                })()}
                <div className="push-down">
                  <MDCButtonReact
                    icon="add"
                    label="Create job"
                    classNames={["mdc-button--raised", "themed-secondary"]}
                    onClick={this.onCreateClick.bind(this)}
                  />
                </div>

                <div className={"job-actions"}>
                  <MDCIconButtonToggleReact
                    icon="delete"
                    tooltipText="Delete job"
                    onClick={this.onDeleteClick.bind(this)}
                  />
                </div>

                <SearchableTable
                  ref={this.refManager.nrefs.jobTable}
                  selectable={true}
                  onRowClick={this.onRowClick.bind(this)}
                  rows={this.jobListToTableData(this.state.jobs)}
                  headers={["Job", "Pipeline", "Snapshot date", "Status"]}
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

export default JobList;
