import React from 'react';

import PipelineView from "./PipelineView";
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import CheckItemList from '../components/CheckItemList';
import { makeRequest } from '../utils/all';


class PipelinesView extends React.Component {

    componentWillUnmount() {

    }

    constructor(props) {
        super(props);

        this.state = {
            loaded: false
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
        })
    }

    onClickListItem(pipeline, e) {

        // load pipeline view
        let props = {
            "pipeline": pipeline,
        }

        if(e.ctrlKey){
            props.readOnly = true;
        }

        orchest.loadView(PipelineView, props);

    }

    onDeleteClick(){

        let selectedIndex = this.refs.pipelineListView.customSelectedIndex();
        
        if(selectedIndex.length === 0){
            alert("You haven't selected a pipeline.")
            return;
        }

        if(confirm("Are you certain that you want to delete this pipeline? Note: this action is irreversible.")){

            selectedIndex.forEach((item, index) => {
                let pipeline_uuid = this.state.listData[item].uuid;

                makeRequest("POST", "/async/pipelines/delete/" + pipeline_uuid).then((_) => {
                    
                    // reload list once removal succeeds
                    this.fetchList();
                })
            });
        }
    }

    onCreateClick(){
        let pipelineName = prompt("Enter a pipeline name");

        if(!pipelineName){
            alert("Please enter a name.")
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
    }

    onForkClick(){
        alert("Forking is not yet supported.")
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }


    render() {
        if(this.state.loaded){
            return <div className={"view-page"}>
                <h2>Pipelines</h2>
                <div className={"pipeline-actions"}>
                    <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                    <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                    <MDCIconButtonToggleReact icon="call_split" onClick={this.onForkClick.bind(this)} />
                </div>
                <CheckItemList ref={"pipelineListView"} onClickListItem={this.onClickListItem.bind(this)} items={this.state.listData} />
            </div>;
        }else{
            return <div className={"view-page"}>
                <h2>Pipelines</h2>
                <p>Loading...</p>
            </div>;
        }

    }
}

export default PipelinesView;