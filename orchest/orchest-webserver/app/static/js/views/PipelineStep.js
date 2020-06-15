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

        let stateText = "Ready";
        
        classNames.push(this.props.executionState.status);

        if(this.props.executionState.status === "SUCCESS"){
        
            let seconds = Math.round((this.props.executionState.ended_time - this.props.executionState.started_time)/1000);

            stateText = "Success (" + seconds + " sec.)";
        }
        if(this.props.executionState.status === "FAILURE"){
            let seconds = Math.round((this.props.executionState.ended_time - this.props.executionState.started_time)/1000);

            stateText = "Failure (" + seconds + " sec.)";
        }
        if(this.props.executionState.status === "STARTED"){
            let seconds = Math.round((new Date() - this.props.executionState.started_time)/1000);
            stateText = "Running (" + seconds + " sec.)";
        }
        if(this.props.executionState.status == "PENDING"){
            stateText = "Pending";
        }
        if(this.props.executionState.status == "ABORTED"){
            stateText = "Aborted";
        }

        let style = {
            transform: "translateX(" + this.props.step.meta_data.position[0] + "px) translateY(" + this.props.step.meta_data.position[1] + "px)"
        }

        return <div data-uuid={this.props.step.uuid} ref={"container"} className={classNames.join(" ")} style={style}>
            <div className={"incoming-connections connection-point"}>
                <div className="inner-dot"></div>
            </div>
            <div className={"execution-indicator"}>
                { ( () => { if(this.props.executionState.status === "SUCCESS"){ return <span className='success'>✓ </span>} } )() }
                { ( () => { if(this.props.executionState.status === "FAILURE"){ return <span className='failure'>✗ </span>} } )() }
                { ( () => { if(this.props.executionState.status === "ABORTED"){ return <span className='aborted'>❗ </span>} } )() }
                {stateText}
            </div>
            <div className="step-label-holder">
                <div className={"step-label"}>
                    {this.props.step.title}
                    <span className='filename'>{this.props.step.file_path}</span>
                </div>
            </div>
            <div className={"outgoing-connections connection-point"}>
                <div className="inner-dot"></div>
            </div>
        </div>
    }
}

export default PipelineStep;