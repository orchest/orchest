import React from 'react';
import { makeRequest, PromiseManager, makeCancelable } from "../lib/utils/all";

class PipelineDetailsLogs extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      logs: ''
    };

    this.promiseManager = new PromiseManager();
  }
  componentDidMount() {

    // start listener
    this.fetchLog();

    this.logFetchInterval = setInterval(() => {
      this.fetchLog();
    }, 1000);

  }

  componentWillUnmount() {
    clearInterval(this.logFetchInterval);
  }

  componentDidUpdate(prevProps){
    if(this.props.step.uuid != prevProps.step.uuid){
      this.setState({
        logs: ""
      })
    }
  }
  
  fetchLog() {

    let logURL = "/async/logs/" + this.props.pipeline.uuid + "/" + this.props.step.uuid;

    if(this.props.pipelineRun){
      logURL += "?pipeline_run_uuid=" + this.props.pipelineRun.run_uuid;
    }

    let fetchLogPromise = makeCancelable(makeRequest("GET", logURL), this.promiseManager);
    
    fetchLogPromise.promise.then((response) => {
      let json = JSON.parse(response);
      if (json.success) {
        this.setState({
          "logs": json.result
        })
      } else {
        console.warn("Could not fetch logs.");
        console.log(json);
      }
    }).catch((error) => {
      if(!error.isCanceled){
        // failed to fetch logs, clear log state
        this.setState({
          "logs": ""
        })
      }
    })
    
  }
  render() {
    return <div className={"detail-subview"}>
      <div className="log-content">
        <div dangerouslySetInnerHTML={{"__html": this.state.logs}}></div>
      </div>
    </div>;
  }
}

export default PipelineDetailsLogs;