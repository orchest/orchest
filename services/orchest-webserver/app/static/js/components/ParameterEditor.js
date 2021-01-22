import React, { Fragment } from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import ParamTree from "./ParamTree";
require("codemirror/mode/javascript/javascript");

class ParameterEditor extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      parameterizedSteps: this.props.parameterizedSteps,
      activeParameter: undefined,
    };
  }

  editParameter(key, uuid) {
    this.setState({
      activeParameter: { key: key, uuid: uuid },
    });
  }

  render() {
    return (
      <div className="parameter-editor">
        <div className="columns">
          <div className="column">
            <ParamTree
              parameterizedSteps={this.state.parameterizedSteps}
              editParameter={this.editParameter.bind(this)}
            />
          </div>
          <div className="column">
            {(() => {
              if (
                this.state.activeParameter !== undefined &&
                this.props.readOnly !== true
              ) {
                return (
                  <Fragment>
                    <CodeMirror
                      value={
                        this.state.parameterizedSteps[
                          this.state.activeParameter.uuid
                        ].parameters[this.state.activeParameter.key]
                      }
                      options={{
                        mode: "application/json",
                        theme: "jupyter",
                        lineNumbers: true,
                      }}
                      onBeforeChange={(editor, data, value) => {
                        this.state.parameterizedSteps[
                          this.state.activeParameter.uuid
                        ].parameters[this.state.activeParameter.key] = value;

                        this.setState({
                          parameterizedSteps: this.state.parameterizedSteps,
                        });

                        // only call onParameterChange if valid JSON Array
                        try {
                          if (Array.isArray(JSON.parse(value))) {
                            this.props.onParameterChange();
                          }
                        } catch {
                          console.warn("Invalid JSON entered");
                        }
                      }}
                    />
                    {(() => {
                      try {
                        JSON.parse(
                          this.state.parameterizedSteps[
                            this.state.activeParameter.uuid
                          ].parameters[this.state.activeParameter.key]
                        );
                      } catch {
                        return (
                          <div className="warning push-up">
                            <i className="material-icons">warning</i> Your input
                            is not valid JSON.
                          </div>
                        );
                      }
                    })()}
                  </Fragment>
                );
              } else if (
                this.state.activeParameter !== undefined &&
                this.props.readOnly === true
              ) {
                return (
                  <>
                    <CodeMirror
                      value={
                        this.state.parameterizedSteps[
                          this.state.activeParameter.uuid
                        ].parameters[this.state.activeParameter.key]
                      }
                      options={{
                        mode: "application/json",
                        theme: "jupyter",
                        lineNumbers: true,
                      }}
                    />
                    <p className="push-up">
                      <i>Read only</i>
                    </p>
                  </>
                );
              }
            })()}
          </div>
          <div className="clear"></div>
        </div>
      </div>
    );
  }
}

export default ParameterEditor;
