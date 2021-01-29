import React, { Fragment } from "react";

class ParamTree extends React.Component {
  truncateParameterValue(value) {
    let maxLength = 50;
    return value.length > maxLength
      ? value.substring(0, maxLength - 1) + "…"
      : value;
  }

  onEditParameter(parameterKey, key) {
    if (this.props.editParameter) {
      this.props.editParameter(parameterKey, key);
    }
  }

  generateParameterElement(stepStrategy) {
    let elements = [];

    elements.push(<b key={stepStrategy.key}>{stepStrategy.title}</b>);

    for (let parameterKey in stepStrategy.parameters) {
      let parameterValueClasses = ["parameter-value"];

      if (this.props.editParameter) {
        parameterValueClasses.push("editable");
      }

      elements.push(
        <div
          key={parameterKey + "-" + stepStrategy.key}
          className="parameter-row"
        >
          <div className="parameter-key">{parameterKey}:</div>
          <div
            className={parameterValueClasses.join(" ")}
            onClick={this.onEditParameter.bind(
              this,
              parameterKey,
              stepStrategy.key
            )}
          >
            {this.truncateParameterValue(stepStrategy.parameters[parameterKey])}
          </div>
        </div>
      );
    }

    return elements;
  }

  generateParameterTree(strategyJSON) {
    let elements = [];

    // first list pipeline parameters
    let pipelineParameterization =
      strategyJSON[orchest.config["PIPELINE_PARAMETERS_RESERVED_KEY"]];
    if (pipelineParameterization) {
      elements.concat(this.generateParameterElement(pipelineParameterization));
    }

    for (const stepUUID in strategyJSON) {
      elements = elements.concat(
        this.generateParameterElement(strategyJSON[stepUUID])
      );
    }

    return elements;
  }
  render() {
    let treeView = this.generateParameterTree(this.props.strategyJSON);

    return (
      <div className="parameter-tree">
        {(() => {
          if (Object.keys(this.props.strategyJSON).length == 0) {
            return (
              <p>This pipeline doesn't define any parameters on its steps.</p>
            );
          }
        })()}
        {treeView}
      </div>
    );
  }
}

export default ParamTree;
