import React from 'react';


class PipelineStep extends React.Component {

    // refresh every second for status update
    componentDidMount(){
        // refresh in a second
        this.componentUpdateInterval = setInterval(() => {
            this.forceUpdate();
        }, 1000);
    }

    componentWillUnmount(){
        clearInterval(this.componentUpdateInterval);
    }

    render() {
        let classNames = ["pipeline-step"];

        if(this.props.selected){
            classNames.push("selected");
        }

        let stateText = "Idle";
        
        classNames.push(this.props.executionState.status);

        if(this.props.executionState.status === "completed"){
            stateText = "Completed";
        }
        if(this.props.executionState.status === "running"){
            let seconds = Math.round((new Date() - this.props.executionState.time)/1000);
            stateText = "Running (" + seconds + " sec.)";
        }

        return <div data-uuid={this.props.step.uuid} ref={"container"} className={classNames.join(" ")}>
            <div className={"incoming-connections connection-point"}>

            </div>
            <div className={"execution-indicator"}>
                { ( () => { if(this.props.executionState.status === "completed"){ return <span>✓ </span>} } )() }
                {stateText}
            </div>
            <div className="step-label-holder">
                <div className={"step-label"}>
                    {this.props.step.title}
                    <span className='filename'>{this.props.step.file_path}</span>
                </div>
            </div>
            <div className={"outgoing-connections connection-point"}>

            </div>
        </div>
    }
}

export default PipelineStep;