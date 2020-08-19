import React from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import PipelineView from './PipelineView';
import { makeRequest, PromiseManager, makeCancelable } from '../lib/utils/all';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';

class NotebookPreviewView extends React.Component {

  componentWillUnmount() {
    
  }

  loadPipelineView(){
    orchest.loadView(PipelineView, { "pipeline_uuid": this.props.pipeline_uuid, readOnly: true, pipelineRun: this.props.pipelineRun });
  }

  componentDidMount(){
    this.fetchNotebookHtml()
  }

  constructor(props){
    super(props);

    this.state = {
      "notebookHtml": undefined
    }

    this.promiseManager = new PromiseManager();
  }

  componentDidUpdate(prevProps){
    if(this.props.step_uuid !== prevProps.step_uuid && this.props.pipeline_uuid !== prevProps.pipeline_uuid){
      this.fetchNotebookHtml()
    }
  }

  fetchNotebookHtml(){

    let notebookURL = "/async/notebook_html/" + this.props.pipeline_uuid + "/" + this.props.step_uuid;

    if(this.props.pipelineRun){
      notebookURL += "?pipeline_run_uuid=" + this.props.pipelineRun.run_uuid;
    }

    let fetchNotebookPromise = makeCancelable(makeRequest("GET", notebookURL), this.promiseManager);
    
    fetchNotebookPromise.promise.then((response) => {
      
      // filter HTML to remove box-shadow CSS rules
      const regex = /(box\-shadow\:|\-webkit\-box-shadow\:)[\d\s\w\,\)\(\-\.]*\;/gm;
        
      response = response.replace(regex, "");
      response = response.replace("<body>\n", "<body style='padding-top:30px;'>\n");

      this.setState({
        "notebookHtml": response
      });

    }).catch((err) => {
      console(err);
    })

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