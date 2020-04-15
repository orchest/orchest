import React from 'react';


class PipelineStep extends React.Component {
    render() {
        let classNames = ["pipeline-step"];

        if(this.props.selected){
            classNames.push("selected");
        }

        return <div data-uuid={this.props.step.uuid} ref={"container"} className={classNames.join(" ")}>
            <div className={"incoming-connections connection-point"}>

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