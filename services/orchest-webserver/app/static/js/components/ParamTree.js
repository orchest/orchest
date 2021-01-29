import React, { Fragment } from "react";

class ParamTree extends React.Component {
  truncateParameterValue(value) {
    let maxLength = 50;
    return value.length > maxLength
      ? value.substring(0, maxLength - 1) + "…"
      : value;
  }

  onEditParameter(parameterKey, stepUUID) {
    if (this.props.editParameter) {
      this.props.editParameter(parameterKey, stepUUID);
    }
  }

  generateParameterStep(parameterizedStep) {
    let elements = [];

    elements.push(
      <b key={parameterizedStep.uuid}>{parameterizedStep.title}</b>
    );

    for (let parameterKey in parameterizedStep.parameters) {
      let parameterValueClasses = ["parameter-value"];

      if (this.props.editParameter) {
        parameterValueClasses.push("editable");
      }

      elements.push(
        <div
          key={parameterKey + "-" + parameterizedStep.uuid}
          className="parameter-row"
        >
          <div className="parameter-key">{parameterKey}:</div>
          <div
            className={parameterValueClasses.join(" ")}
            onClick={this.onEditParameter.bind(
              this,
              parameterKey,
              parameterizedStep.uuid
            )}
          >
            {this.truncateParameterValue(
              parameterizedStep.parameters[parameterKey]
            )}
          </div>
        </div>
      );
    }

    return elements;
  }

  generateParameterTree(parameterizedSteps) {
    let elements = [];

    for (const stepUUID in parameterizedSteps) {
      elements = elements.concat(
        this.generateParameterStep(parameterizedSteps[stepUUID])
      );
    }

    return elements;
  }
  render() {
    let treeView = this.generateParameterTree(this.props.parameterizedSteps);

    return (
      <div className="parameter-tree">
        {(() => {
          if (Object.keys(this.props.parameterizedSteps).length == 0) {
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
