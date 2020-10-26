import React from "react";
import ParamTree from "./ParamTree";

class PipelineRunDetail extends React.Component {
  constructor(props) {
    super(props);
  }
  componentDidMount() {}

  render() {
    return (
      <div>
        <ParamTree />
      </div>
    );
  }
}

export default PipelineRunDetail;
