import React from 'react';
import PipelineView from "./PipelineView";
import {MDCRipple} from "@material/ripple";
import MDCButtonReact from '../mdc-components/MDCButtonReact';

class HeaderButtons extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            pipeline: undefined,
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
        orchest.loadView(PipelineView, {"pipeline": {"uuid": this.state.pipeline.uuid}});

        this.setState({
            "showBack": false
        });
    }

    showBack(){
        this.setState({
            showBack: true
        })
    }

    setPipeline(pipelineJson){
        this.setState({
            "pipeline": pipelineJson,
        });
    }

    render() {

        if(this.state.pipeline){
            return <div>
                <span className="pipeline-name">{this.state.pipeline.name}</span>
                {this.state.showBack ? <MDCButtonReact onClick={this.openView.bind(this)} icon="arrow_back" label="Back to Pipeline" /> : <span></span> }
            </div>
        }
        else{
            return <div></div>;
        }
        
    }
}

export default HeaderButtons;