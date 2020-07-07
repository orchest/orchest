import React from 'react';
import MDCDataTableReact from '../mdc-components/MDCDataTableReact';

class PipelineRunsList extends React.Component {
    
    render() {

        return <MDCDataTableReact classNames={['fullwidth']} headers={['Parameters']} rows={this.props.pipelineRuns} />
    }

}

export default PipelineRunsList