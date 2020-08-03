import React from 'react';


class PipelineStep extends React.Component {

    componentDidMount(){
        this.updatePosition(this.props.step.meta_data.position)
    }

    updatePosition(position){
        // note: outside of normal React loop for performance
        this.refs.container.style.transform = "translateX(" + position[0] + "px) translateY(" + position[1] + "px)";
    }

    render() {
        let classNames = ["pipeline-step"];

        if(this.props.selected){
            classNames.push("selected");
        }

        let stateText = "Ready";

        classNames.push(this.props.executionState.status);

        if(this.props.executionState.status === "SUCCESS"){

            let seconds = Math.round((this.props.executionState.finished_time - this.props.executionState.started_time)/1000);

            stateText = "Completed (" + seconds + " sec.)";
        }
        if(this.props.executionState.status === "FAILURE"){
            let seconds = Math.round((this.props.executionState.finished_time - this.props.executionState.started_time)/1000);

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


        return <div data-uuid={this.props.step.uuid} ref={"container"} className={classNames.join(" ")} >
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
