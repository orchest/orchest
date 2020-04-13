import React from 'react';
import PipelineView from "./PipelineView";
import {MDCRipple} from "@material/ripple";

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
        if(this.refs.backButton && !this.backButtonRipple){
            this.backButtonRipple = new MDCRipple(this.refs.backButton);
        }
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
                <button ref={"backButton"} onClick={this.openView.bind(this)}
                        className="mdc-button mdc-button--raised save-button">
                    <div className="mdc-button__ripple"></div>
                    <i className="material-icons mdc-button__icon" aria-hidden="true">arrow_back</i>
                    <span className="mdc-button__label">Back to Pipeline</span>
                </button>
            </div>;
        }else{
            return <div>

            </div>;
        }

    }
}

export default HeaderButtons;