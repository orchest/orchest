import React, { Fragment } from 'react';

import PipelineView from "./PipelineView";
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import CheckItemList from '../components/CheckItemList';
import { makeRequest } from '../utils/all';
import MDCButtonReact from '../mdc-components/MDCButtonReact';
import MDCTextFieldReact from '../mdc-components/MDCTextFieldReact';
import MDCLinearProgressReact from '../mdc-components/MDCLinearProgressReact';
import MDCDialogReact from '../mdc-components/MDCDialogReact';


class PipelinesView extends React.Component {

    componentWillUnmount() {

    }

    constructor(props) {
        super(props);

        this.state = {
            loaded: false,
            createModal: false,
        }
    }

    componentDidMount() {

        this.fetchList();

        // set headerbar
        orchest.headerBarComponent.setPipeline(undefined);
    }

    fetchList(){
        // initialize REST call for pipelines
        makeRequest("GET", '/async/pipelines').then((response) => {
            let data = JSON.parse(response);            
            this.setState({loaded: true, listData: data.result})
            this.refs.pipelineListView.deselectAll()
        })
    }

    onClickListItem(pipeline, e) {

        // load pipeline view
        let props = {
            "pipeline_uuid": pipeline.uuid,
        }

        if(e.ctrlKey || e.metaKey){
            props.readOnly = true;
        }

        orchest.loadView(PipelineView, props);

    }

    onDeleteClick(){

        let selectedIndex = this.refs.pipelineListView.customSelectedIndex();
        
        if(selectedIndex.length === 0){
            orchest.alert("Error", "You haven't selected a pipeline.")
            return;
        }

        orchest.confirm("Warning", "Are you certain that you want to delete this pipeline? (This cannot be undone.)", () => {

            selectedIndex.forEach((item, index) => {
                let pipeline_uuid = this.state.listData[item].uuid;

                makeRequest("POST", "/async/pipelines/delete/" + pipeline_uuid).then((_) => {
                    
                    // reload list once removal succeeds
                    this.fetchList();
                })
            });
        })
    }

    onCreateClick(){
        this.setState({
            createModal: true
        })

        this.refs.createPipelineNameTextField.focus();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }

    onSubmitModal(){
        let pipelineName = this.refs.createPipelineNameTextField.mdc.value;

        if(!pipelineName){
            orchest.alert("Error", "Please enter a name.")
            return;
        }

        let data = new FormData();
        data.append("name", pipelineName);

        makeRequest("POST", "/async/pipelines/create", {
            type: "FormData",
            content: data
        }).then((_) => {
            // reload list once creation succeeds
            this.fetchList()
        })

        this.setState({
            createModal: false
        })
    }

    onCancelModal(){
        this.setState({
            createModal: false
        })
    }

    render() {
        if(this.state.loaded){
            return <div className={"view-page"}>

            {(() => {
                if(this.state.createModal){
                    return <MDCDialogReact title="Create a new pipeline" 
                        content={
                            <MDCTextFieldReact ref={'createPipelineNameTextField'} classNames={['fullwidth']} label="Experiment name" />
                    } actions={
                        <Fragment>
                            <MDCButtonReact icon="device_hub" classNames={["mdc-button--raised", "themed-secondary"]} label="Create pipeline" onClick={this.onSubmitModal.bind(this)} />                            
                            <MDCButtonReact icon="close" label="Cancel" classNames={["push-left"]} onClick={this.onCancelModal.bind(this)} />
                        </Fragment>
                    } />
                }
            })() }

                <h2>Pipelines</h2>
                <div className={"pipeline-actions"}>
                    <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                    <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                </div>
                <CheckItemList ref={"pipelineListView"} onClickListItem={this.onClickListItem.bind(this)} items={this.state.listData} />
            </div>;
        }else{
            return <div className={"view-page"}>
                <h2>Pipelines</h2>
                <MDCLinearProgressReact />
            </div>;
        }

    }
}

export default PipelinesView;