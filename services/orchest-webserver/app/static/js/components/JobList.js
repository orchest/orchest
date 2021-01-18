import React, { Fragment } from "react";

import SearchableTable from "./SearchableTable";
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import CreateJobView from "../views/CreateJobView";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
} from "../lib/utils/all";
import { getPipelineJSONEndpoint } from "../utils/webserver-utils";
import JobView from "../views/JobView";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";

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
      makeRequest("GET", `/store/jobs?project_uuid=${this.props.project_uuid}`),
      this.promiseManager
    );

    fetchListPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.setState({
          jobs: result,
          jobsSearchMask: new Array(result.length).fill(1),
        });
      })
      .catch((e) => {
        console.log(e);
      });
  }

  componentWillUnmount() {}

  onCreateClick() {
    this.setState({
      createModal: true,
    });
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
              "/store/jobs/" + this.state.jobs[selectedRows[x]].uuid
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

    makeRequest("POST", "/store/jobs/new", {
      type: "json",
      content: {
        pipeline_uuid: pipeline_uuid,
        pipeline_name: pipelineName,
        project_uuid: this.props.project_uuid,
        name: this.refManager.refs.formJobName.mdc.value,
        draft: true,
      },
    }).then((response) => {
      let job = JSON.parse(response);

      orchest.loadView(CreateJobView, {
        job: {
          name: job.name,
          pipeline_uuid: pipeline_uuid,
          project_uuid: this.props.project_uuid,
          uuid: job.uuid,
        },
      });
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

    if (job.draft === true) {
      orchest.loadView(CreateJobView, {
        job: {
          name: job.name,
          pipeline_uuid: job.pipeline_uuid,
          project_uuid: job.project_uuid,
          uuid: job.uuid,
        },
      });
    } else {
      let pipelineJSONEndpoint = getPipelineJSONEndpoint(
        job.pipeline_uuid,
        job.project_uuid,
        job.uuid
      );

      makeRequest("GET", pipelineJSONEndpoint).then((response) => {
        let result = JSON.parse(response);
        if (result.success) {
          let pipeline = JSON.parse(result["pipeline_json"]);

          orchest.loadView(JobView, {
            pipeline: pipeline,
            job: job,
            parameterizedSteps: JSON.parse(job.strategy_json),
          });
        } else {
          console.warn("Could not load pipeline.json");
          console.log(result);
        }
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
        new Date(
          jobs[x].created.replace(/T/, " ").replace(/\..+/, "") + " GMT"
        ).toLocaleString(),
        jobs[x].draft ? "Draft" : "Submitted",
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
                                options={this.generatePipelineOptions(
                                  this.state.pipelines
                                )}
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
                            <MDCButtonReact
                              icon="close"
                              classNames={["push-left"]}
                              label="Cancel"
                              onClick={this.onCancelModal.bind(this)}
                            />
                          </Fragment>
                        }
                      />
                    );
                  }
                })()}

                <div className={"job-actions"}>
                  <MDCIconButtonToggleReact
                    icon="add"
                    tooltipText="Add job"
                    onClick={this.onCreateClick.bind(this)}
                  />
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
                  headers={["Job", "Pipeline", "Date created", "Status"]}
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
