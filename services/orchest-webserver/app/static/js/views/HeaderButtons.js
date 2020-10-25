import React from 'react';
import PipelineView from "./PipelineView";
import {MDCRipple} from "@material/ripple";
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import { makeRequest } from '../lib/utils/all';

class HeaderButtons extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            pipeline_uuid: undefined,
            project_uuid: undefined,
            pipeline_path: "",
            showBack: false
        }
    }

    componentWillUnmount() {
    }

    componentDidMount() {

    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }

    openView() {
        orchest.loadView(PipelineView, {pipeline_uuid: this.state.pipeline.uuid, project_uuid: this.state.project_uuid});

        this.setState({
            "showBack": false
        });
    }

    showBack(){
        this.setState({
            showBack: true
        })
    }

    clearPipeline(){
        this.setState({
            "pipeline": undefined,
        });
    }

    setPipeline(pipelineJson, project_uuid){
        // fetch pipeline path
        makeRequest("GET", `/async/pipelines/${project_uuid}/${pipelineJson.uuid}`).then((response) => {
            let pipeline = JSON.parse(response)

            this.setState({
                "pipeline_path": pipeline.path
            })
        })

        this.setState({
            "pipeline": pipelineJson,
            "project_uuid": project_uuid,
        });
    }

    render() {

        if(this.state.pipeline){
            return <div>
                <span className="pipeline-name">{this.state.pipeline.name} [{this.state.pipeline_path}]</span>
                {this.state.showBack ? <MDCButtonReact classNames={["mdc-button--raised"]} onClick={this.openView.bind(this)} icon="arrow_back" label="Back to Pipeline" /> : <span></span> }
            </div>
        }
        else{
            return <div></div>;
        }
        
    }
}

export default HeaderButtons;