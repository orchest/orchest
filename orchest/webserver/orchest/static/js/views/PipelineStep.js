import React from 'react';


class PipelineStep extends React.Component {
    render() {
        return <div data-uuid={this.props.step.uuid} ref={"container"} className={"pipeline-step"}>
            <div className={"incoming-connections connection-point"}>

            </div>
            <div className="step-label-holder">
                <div className={"step-label"}>
                    {this.props.step.name}
                </div>
            </div>
            <div className={"outgoing-connections connection-point"}>

            </div>
        </div>
    }
}

export default PipelineStep;