import React from 'react';
import MDCButtonReact from '../mdc-components/MDCButtonReact';
import PipelineView from './PipelineView';

class NotebookPreviewView extends React.Component {
  componentWillUnmount() {
  }

  loadPipelineView(){
    orchest.loadView(PipelineView, { "pipeline": this.props.pipeline, readOnly: true });
  }

  render() {
    return <div className={"view-page"}>
        <MDCButtonReact
            classNames={["close-button"]}
            icon="close"
            onClick={this.loadPipelineView.bind(this)}
        />
        <div className={"notebook-html-holder"}>
            
        </div>
    </div>;
  }
}

export default NotebookPreviewView;