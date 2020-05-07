import React from 'react';
import PipelineView from "./PipelineView";
import {MDCRipple} from "@material/ripple";
import MDCButtonReact from '../mdc-components/MDCButtonReact';

class HeaderButtons extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            pipeline: undefined
        }
    }

    componentWillUnmount() {
    }

    componentDidMount() {

    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }

    openView() {
        orchest.loadView(PipelineView, {"uuid": this.state.pipeline.uuid});

        this.setState({
            "pipeline": undefined
        });
    }

    setPipeline(pipeline){
        this.setState({
            "pipeline": pipeline
        });
    }

    render() {
        if(this.state.pipeline){
            return <div>
                <MDCButtonReact onClick={this.openView.bind(this)} icon="arrow_back" label="Back to Pipeline" />
            </div>;
        }else{
            return <div>

            </div>;
        }

    }
}

export default HeaderButtons;