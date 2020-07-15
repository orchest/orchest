import React, { Fragment } from 'react';

import SearchableTable from '../components/SearchableTable';
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from '../mdc-components/MDCTextFieldReact';
import Modal from '../components/Modal';
import MDCSelectReact from '../mdc-components/MDCSelectReact';
import MDCButtonReact from '../mdc-components/MDCButtonReact';
import CreateExperimentView from './CreateExperimentView';
import { makeRequest, uuidv4 } from '../utils/all';
import ExperimentView from './ExperimentView';
import MDCLinearProgressReact from '../mdc-components/MDCLinearProgressReact';

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

    }

    componentDidMount() {

        // retrieve pipelines once on component render
        makeRequest("GET", "/async/pipelines").then((response) => {
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

        makeRequest("GET", "/store/experiments").then((response) => {
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

    onDeleteClick(){

        // get experiment selection
        let selectedRows = this.refs.experimentTable.getSelectedRowIndices();
        
        // delete indices
        let promises = [];

        for(let x = 0; x < selectedRows.length; x++){
            promises.push(
                makeRequest(
                    "DELETE", "/store/experiments/" + this.state.experiments[selectedRows[x]].uuid
                )
            );
        }

        Promise.all(promises).then(() => {
            this.fetchList();

            this.refs.experimentTable.setSelectedRowIds([]);
        })

    }

    onSubmitModal(){

        let pipeline_uuid = this.refs.formPipeline.mdc.value;
        let experiment_uuid = uuidv4();

        // TODO: in this part of the flow copy the pipeline directory to make
        // sure the pipeline no longer changes
        this.setState({
            createModelLoading: true
        });

        makeRequest("POST", "/async/experiments/create", {
            type: 'json',
            content: {
                pipeline_uuid: pipeline_uuid,
                experiment_uuid: experiment_uuid
            }
        }).then((response) => {

            let result = JSON.parse(response);
            if (result.success) {

                orchest.loadView(CreateExperimentView, {
                    "experiment": {
                        "name": this.refs.formExperimentName.mdc.value,
                        "pipeline_uuid": pipeline_uuid,
                        "uuid": experiment_uuid,
                    }
                });

            } else {
                console.warn("Could not load pipeline.json");
                console.log(result);
            }
        });
    }
    onCancelModal(){
        this.setState({
            createModal: false
        });
    }

    onRowClick(row, idx, event){

        let experiment = this.state.experiments[idx];

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

    experimentListToTableData(experiments){
        let rows = [];
        for(let x = 0; x < experiments.length; x++){
            rows.push([
                experiments[x].name,
                experiments[x].pipeline_name,
                experiments[x].created,
            ])
        }
        return rows;
    }

    generatePipelineOptions(pipelines){
        let pipelineOptions = [];

        for(let x = 0; x < pipelines.length; x++){
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

                if(this.state.experiments && this.state.pipelines){
                    return <Fragment>
                        {(() => {
                            if(this.state.createModal){
                                return <Modal body={
                                    <Fragment>
                                        <div className="create-experiment-modal">
                                            <h2>Create a new experiment</h2>
                                            
                                            <MDCTextFieldReact ref="formExperimentName" classNames={['fullwidth']} label="Experiment name" />
                                            
                                            <MDCSelectReact ref="formPipeline" label="Pipeline" options={this.generatePipelineOptions(this.state.pipelines)} />

                                            {(() => {
                                                if(this.state.createModelLoading){
                                                    return <MDCLinearProgressReact />
                                                }
                                            })()}

                                            <MDCButtonReact disabled={this.state.createModelLoading} icon="science" classNames={["mdc-button--raised", "themed-secondary"]} label="Create experiment" onClick={this.onSubmitModal.bind(this)} />
                                            
                                            <MDCButtonReact icon="close" label="Cancel" onClick={this.onCancelModal.bind(this)} />
                                        </div>
                                    </Fragment>
                                } />
                            }
                        })() }

                        <div className={"experiment-actions"}>
                            <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                            <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                        </div>

                        <SearchableTable ref="experimentTable" selectable={true} onRowClick={this.onRowClick.bind(this)} rows={this.experimentListToTableData(this.state.experiments)} headers={['Experiment', 'Pipeline', 'Date created']} />
                    </Fragment>
                }else{
                    return <MDCLinearProgressReact />
                }

            })()}

            

        </div>;
    }
}

export default ExperimentsView;