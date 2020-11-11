import React from "react";
import ExperimentList from "../components/ExperimentList";
import ProjectBasedView from "./ProjectBasedView";

class ExperimentsView extends React.Component {
  render() {
    return <ProjectBasedView childView={ExperimentList} />;
  }
}

export default ExperimentsView;
