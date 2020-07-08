import React, { Fragment } from 'react';

import MDCDataTableReact from '../mdc-components/MDCDataTableReact';
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import MDCTextFieldReact from '../mdc-components/MDCTextFieldReact';
import Modal from '../components/Modal';
import MDCSelectReact from '../mdc-components/MDCSelectReact';
import MDCButtonReact from '../mdc-components/MDCButtonReact';
import CreateExperimentView from './CreateExperimentView';
import { makeRequest } from '../utils/all';
import ExperimentView from './ExperimentView';

class ExperimentsView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            createModal: false,
        }

    }

    componentDidMount() {
        this.fetchList()
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

    }

    fetchList() {

    }

    componentWillUnmount() {

    }

    onCreateClick() {
        this.setState({
            createModal: true
        })
    }
    onDeleteClick(){

    }

    onSubmitModal(){

        makeRequest("GET", "/async/pipelines", {

        }).then((response) => {
            let result = JSON.parse(response);
            if(result.success && result.result.length > 0){
                let firstPipeline = result.result[0];

                makeRequest("GET", "/async/pipelines/json/get/" + firstPipeline.uuid, {
                }).then((response) => {
        
                    let result = JSON.parse(response);
                    if (result.success) {

                        orchest.loadView(CreateExperimentView, {"pipeline": JSON.parse(result['pipeline_json']), "experiment": {"name": "My First Experiment TM"} });
        
                    } else {
                        console.warn("Could not load pipeline.json");
                        console.log(result);
                    }
                });

                
            }else{
                console.warn("Could not load a first pipeline");
                console.log(result);
            }
        });
    }
    onCancelModal(){
        this.setState({
            createModal: false
        });
    }

    onRowClick(){

        makeRequest("GET", "/async/pipelines", {
        }).then((response) => {
            let result = JSON.parse(response);
            if (result.success && result.result.length > 0) {
                let firstPipeline = result.result[0];

                makeRequest("GET", "/async/pipelines/json/get/" + firstPipeline.uuid, {
                }).then((response) => {

                    let result = JSON.parse(response);
                    if (result.success) {

                        let pipeline = JSON.parse(result['pipeline_json']);

                        /*
                            Stub: Generate paramaterizedSteps, this should come
                            from experiment record in orchest-api.
                        */
                        let parameterizedSteps = {};

                        for (const stepUUID in pipeline.steps) {
                            let parameterizedStep = JSON.parse(
                                JSON.stringify(pipeline.steps[stepUUID])
                            );

                            if (parameterizedStep.parameters && Object.keys(parameterizedStep.parameters).length > 0) {
                                for (const paramKey in parameterizedStep.parameters) {

                                    // Note: the list of parameters for each key will always be
                                    // a string in the 'parameterizedSteps' data structure. This
                                    // facilitates preserving user added indendation.

                                    // Validity of the user string as JSON is checked client
                                    // side (for now).
                                    parameterizedStep.parameters[paramKey] =
                                        JSON.stringify([parameterizedStep.parameters[paramKey]]);
                                }

                                parameterizedSteps[stepUUID] = parameterizedStep;
                            }
                        }
                        /* end stub */

                        orchest.loadView(ExperimentView, {
                            "pipeline": pipeline,
                            "experiment": { "name": "My First Experiment TM" },
                            "parameterizedSteps": parameterizedSteps
                        });

                    } else {
                        console.warn("Could not load pipeline.json");
                        console.log(result);
                    }
                });
            }
        });

    }

    render() {

        let experiments = [
            ["LR search", "Training MNIST", "26 Jul. 2020"],
            ["Feature aug.", "Training MNIST", "24 Jul. 2020"],
            ["Feature aug.", "Training MNIST", "24 Jul. 2020"],
            ["Feature aug.", "LSAT solve", "24 Jul. 2020"],
            ["Small train set.", "LSAT solve", "21 Jul. 2020"],
        ]

        return <div className={"view-page experiments-page"}>

            <h2>Experiments</h2>

            {(() => {
                if(this.state.createModal){
                    return <Modal body={
                        <Fragment>
                            <h2>Create a new experiment</h2>
                            <MDCTextFieldReact classNames={['fullwidth']} label="Experiment name" />
                            <MDCSelectReact label="Pipeline" options={[
                                ["MNIST custom model"]
                            ]} />
                            <MDCButtonReact icon="science" classNames={["mdc-button--raised"]} label="Create experiment" onClick={this.onSubmitModal.bind(this)} />
                            
                            <MDCButtonReact icon="close" label="Cancel" onClick={this.onCancelModal.bind(this)} />
                        </Fragment>
                    } />
                }
            })() }

            <MDCTextFieldReact classNames={['mdc-text-field--outlined fullwidth']} notched={true} label="Search" />

            <div className={"experiment-actions"}>
                <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
            </div>

            <MDCDataTableReact onRowClick={this.onRowClick.bind(this)} classNames={['fullwidth']} headers={['Experiment', 'Pipeline', 'Date created']} rows={experiments} />

        </div>;
    }
}

export default ExperimentsView;