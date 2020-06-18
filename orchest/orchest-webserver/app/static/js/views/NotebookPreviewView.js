import React from 'react';
import MDCButtonReact from '../mdc-components/MDCButtonReact';
import PipelineView from './PipelineView';
import { makeRequest } from '../utils/all';
import MDCLinearProgressReact from '../mdc-components/MDCLinearProgressReact';

class NotebookPreviewView extends React.Component {
  componentWillUnmount() {
  }

  loadPipelineView(){
    orchest.loadView(PipelineView, { "pipeline": this.props.pipeline, readOnly: true });
  }

  componentDidMount(){
    this.fetchNotebookHtml()
  }

  constructor(props){
    super(props);

    this.state = {
      "notebookHtml": undefined
    }
  }

  componentDidUpdate(prevProps){
    if(this.props.step_uuid !== prevProps.step_uuid && this.props.pipeline.uuid !== prevProps.pipeline.uuid){
      this.fetchNotebookHtml()
    }
  }

  fetchNotebookHtml(){
    makeRequest("GET", "/async/notebook_html/" + this.props.pipeline.uuid + "/" + this.props.step_uuid).then((response) => {
      
      // filter HTML to remove box-shadow CSS rules
      const regex = /(box\-shadow\:|\-webkit\-box-shadow\:)[\d\s\w\,\)\(\-\.]*\;/gm;
        
      response = response.replace(regex, "");

      this.setState({
        "notebookHtml": response
      });
    }).catch((err) => {
      console(err);
    });
  }

  render() {
    return <div className={"view-page no-padding"}>
        <MDCButtonReact
            classNames={["close-button"]}
            icon="close"
            onClick={this.loadPipelineView.bind(this)}
        />

        {(() => {

          if(this.state.notebookHtml === undefined){
            return <MDCLinearProgressReact />
          }else{
            return <iframe className={"notebook-iframe borderless fullsize"} src={"data:text/html;charset=utf-8," + escape(this.state.notebookHtml)}></iframe>;
          }

        })()}
        
    </div>;
  }
}

export default NotebookPreviewView;