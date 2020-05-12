import React from 'react';
import { handleErrors } from "../utils/all";

class PipelineDetailsLogs extends React.Component {
  constructor(props){
    super(props);

    this.state = {
      logs: ''
    };
  }
  componentDidMount(){
    // start listener
    this.fetchLog();

    this.logFetchInterval = setInterval(() => {
        this.fetchLog();
    }, 1000);
  }
  componentWillUnmount() {
    clearInterval(this.logFetchInterval);
  }

  fetchLog(){

    fetch("/async/logs/" + this.props.pipeline.uuid + "/" + this.props.step.uuid, {
        method: "GET",
        cache: "no-cache",
        redirect: "follow",
        referrer: "no-referrer"
    }).then(handleErrors).then((response) => {
        response.json().then((json) => {
            if(json.success){
              this.setState({
                "logs": json.result
              })
            }else{
                console.warn("Could not fetch logs.");
                console.log(json);
            }
        })
    });
  }
  render() {
    return <div className={"detail-subview"}>
        <div className="log-content">
            {this.state.logs}
        </div>
    </div>;
  }
}

export default PipelineDetailsLogs;