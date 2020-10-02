import React, { Fragment } from 'react';

import SearchableTable from '../components/SearchableTable';
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import MDCSelectReact from '../lib/mdc-components/MDCSelectReact';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import CreateExperimentView from './CreateExperimentView';
import { makeRequest, uuidv4, PromiseManager, makeCancelable, RefManager } from '../lib/utils/all';
import ExperimentView from './ExperimentView';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import MDCDialogReact from '../lib/mdc-components/MDCDialogReact';

class ExperimentsView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            createModal: false,
            createModelLoading: false,
            experiments: undefined,
            pipelines: undefined,
            experimentsSearchMask: new Array(0).fill(1)
        }

        this.promiseManager = new PromiseManager();
        this.refManager = new RefManager();

    }

    componentWillUnmount(){
        this.promiseManager.cancelCancelablePromises();
    }

    componentDidMount() {

        // retrieve pipelines once on component render
        let pipelinePromise = makeCancelable(makeRequest("GET", "/async/pipelines"), this.promiseManager);
        
        pipelinePromise.promise.then((response) => {
            let result = JSON.parse(response);

            this.setState({
                "pipelines": result.result
            });

        }).catch((e) => {
            console.log(e);
        })


        // retrieve experiments
        this.fetchList()
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

    }

    fetchList() {

        let fetchListPromise = makeCancelable(makeRequest("GET", "/store/experiments"), this.promiseManager);
        
        fetchListPromise.promise.then((response) => {
            let result = JSON.parse(response);

            this.setState({
                experiments: result,
                experimentsSearchMask: new Array(result.length).fill(1)
            });

        }).catch((e) => {
            console.log(e);
        })
    }

    componentWillUnmount() {

    }

    onCreateClick() {
        this.setState({
            createModal: true
        })
    }

    onDeleteClick() {

        // get experiment selection
        let selectedRows = this.refManager.refs.experimentTable.getSelectedRowIndices();

        if(selectedRows.length == 0){
            return;
        }

        // delete indices
        let promises = [];

        for (let x = 0; x < selectedRows.length; x++) {
            promises.push(
                makeRequest(
                    "DELETE", "/store/experiments/" + this.state.experiments[selectedRows[x]].uuid
                )
            );

            // don't wait for finish on orchest-api DELETE
            // TODO: wait until orchest-api endpoint is working
            // makeRequest("DELETE", "/api-proxy/api/experiments/" + this.state.experiments[selectedRows[x]].uuid)
        }

        Promise.all(promises).then(() => {
            this.fetchList();

            this.refManager.refs.experimentTable.setSelectedRowIds([]);
        })

    }

    onSubmitModal() {

        let pipelineUUID = this.refManager.refs.formPipeline.mdc.value;
        let pipelineName;
        for (let x = 0; x < this.state.pipelines.length; x++) {
            if (this.state.pipelines[x].uuid === pipelineUUID) {
                pipelineName = this.state.pipelines[x].name
                break;
            }
        }

        if(this.refManager.refs.formExperimentName.mdc.value.length == 0){
            orchest.alert("Error", "Please enter a name for your experiment.");
            return;
        }

        if(this.refManager.refs.formPipeline.mdc.value == ''){
            orchest.alert("Error", "Please choose a pipeline.");
            return;
        }

        // TODO: in this part of the flow copy the pipeline directory to make
        // sure the pipeline no longer changes
        this.setState({
            createModelLoading: true
        });

        makeRequest("POST", "/async/experiments/create", {
            type: 'json',
            content: {
                pipeline_uuid: pipelineUUID,
                pipeline_name: pipelineName,
                name: this.refManager.refs.formExperimentName.mdc.value,
            }
        }).then((response) => {

            let experiment = JSON.parse(response);

            orchest.loadView(CreateExperimentView, {
                "experiment": {
                    "name": experiment.name,
                    "pipeline_uuid": experiment.pipeline_uuid,
                    "uuid": experiment.uuid,
                }
            });

        });
    }
    onCancelModal() {
        this.setState({
            createModal: false
        });
    }

    onRowClick(row, idx, event) {

        let experiment = this.state.experiments[idx];

        if (experiment.draft === true) {

            orchest.loadView(CreateExperimentView, {
                "experiment": {
                    "name": experiment.name,
                    "pipeline_uuid": experiment.pipeline_uuid,
                    "uuid": experiment.uuid,
                }
            });

        } else {
            makeRequest("GET", "/async/pipelines/json/get/" + experiment.pipeline_uuid, {
            }).then((response) => {

                let result = JSON.parse(response);
                if (result.success) {

                    let pipeline = JSON.parse(result['pipeline_json']);

                    orchest.loadView(ExperimentView, {
                        "pipeline": pipeline,
                        "experiment": experiment,
                        "parameterizedSteps": JSON.parse(experiment.strategy_json)
                    });

                } else {
                    console.warn("Could not load pipeline.json");
                    console.log(result);
                }
            });
        }

    }

    experimentListToTableData(experiments) {
        let rows = [];
        for (let x = 0; x < experiments.length; x++) {
            rows.push([
                experiments[x].name,
                experiments[x].pipeline_name,
                experiments[x].created,
                experiments[x].draft ? "Draft" : "",
            ])
        }
        return rows;
    }

    generatePipelineOptions(pipelines) {
        let pipelineOptions = [];

        for (let x = 0; x < pipelines.length; x++) {
            pipelineOptions.push([
                pipelines[x].uuid,
                pipelines[x].name
            ])
        }

        return pipelineOptions
    }

    render() {

        return <div className={"view-page experiments-page"}>

            <h2>Experiments</h2>

            {(() => {

                if (this.state.experiments && this.state.pipelines) {
                    return <Fragment>
                        {(() => {
                            if (this.state.createModal) {
                                return <MDCDialogReact title="Create a new experiment" content={
                                    <Fragment>
                                        <div className="create-experiment-modal">

                                            <MDCTextFieldReact ref={this.refManager.nrefs.formExperimentName} classNames={["fullwidth push-down"]} label="Experiment name" />

                                            <MDCSelectReact ref={this.refManager.nrefs.formPipeline} label="Pipeline" classNames={["fullwidth"]} options={this.generatePipelineOptions(this.state.pipelines)} />

                                            {(() => {
                                                if (this.state.createModelLoading) {
                                                    return <Fragment>
                                                        <MDCLinearProgressReact />
                                                        <p>Copying pipeline directory...</p>
                                                    </Fragment>
                                                }
                                            })()}

                                        </div>
                                    </Fragment>
                                } actions={<Fragment>
                                    <MDCButtonReact disabled={this.state.createModelLoading} icon="science" classNames={["mdc-button--raised", "themed-secondary"]} label="Create experiment" onClick={this.onSubmitModal.bind(this)} />
                                    <MDCButtonReact icon="close" classNames={["push-left"]} label="Cancel" onClick={this.onCancelModal.bind(this)} />
                                </Fragment>} />
                            }
                        })()}

                        <div className={"experiment-actions"}>
                            <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                            <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                        </div>

                        <SearchableTable ref={this.refManager.nrefs.experimentTable} selectable={true} onRowClick={this.onRowClick.bind(this)} rows={this.experimentListToTableData(this.state.experiments)} headers={['Experiment', 'Pipeline', 'Date created', 'Status']} />
                    </Fragment>
                } else {
                    return <MDCLinearProgressReact />
                }

            })()}



        </div>;
    }
}

export default ExperimentsView;