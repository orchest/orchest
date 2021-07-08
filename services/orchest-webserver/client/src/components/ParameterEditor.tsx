// @ts-check
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import ParamTree from "./ParamTree";
import "codemirror/mode/javascript/javascript";

/**
 * @typedef {{
 *  strategyJSON?: any;
 *  pipelineName: string;
 *  readOnly?: boolean;
 *  onParameterChange?: (value: any) => void;
 * }} TParameterEditorProps
 *
 * @type React.FC<TParameterEditorProps>
 */
const ParameterEditor = (props) => {
  const [state, setState] = React.useState({
    strategyJSON: props.strategyJSON,
    activeParameter: undefined,
  });

  React.useEffect(() => {
    if (props.strategyJSON)
      setState((prevState) => ({
        ...prevState,
        strategyJSON: props.strategyJSON,
      }));
  }, [props.strategyJSON]);

  const editParameter = (key, strategyJSONKey) => {
    setState((prevState) => ({
      ...prevState,
      activeParameter: { key: key, strategyJSONKey: strategyJSONKey },
    }));
  };

  return (
    <div className="parameter-editor">
      <div className="columns">
        <div className="column">
          <ParamTree
            pipelineName={props.pipelineName}
            strategyJSON={state.strategyJSON}
            editParameter={editParameter.bind(this)}
          />
        </div>
        <div className="column">
          {(() => {
            if (
              state.activeParameter !== undefined &&
              props.readOnly !== true
            ) {
              return (
                <React.Fragment>
                  <CodeMirror
                    value={
                      state.strategyJSON[state.activeParameter.strategyJSONKey]
                        .parameters[state.activeParameter.key]
                    }
                    options={{
                      mode: "application/json",
                      theme: "jupyter",
                      lineNumbers: true,
                    }}
                    onBeforeChange={(editor, data, value) => {
                      state.strategyJSON[
                        state.activeParameter.strategyJSONKey
                      ].parameters[state.activeParameter.key] = value;

                      setState((prevState) => ({
                        ...prevState,
                        strategyJSON: state.strategyJSON,
                      }));

                      // only call onParameterChange if valid JSON Array
                      try {
                        if (Array.isArray(JSON.parse(value))) {
                          props.onParameterChange(state.strategyJSON);
                        }
                      } catch {
                        console.warn("Invalid JSON entered");
                      }
                    }}
                  />
                  {(() => {
                    try {
                      JSON.parse(
                        state.strategyJSON[
                          state.activeParameter.strategyJSONKey
                        ].parameters[state.activeParameter.key]
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
                </React.Fragment>
              );
            } else if (
              state.activeParameter !== undefined &&
              props.readOnly === true
            ) {
              return (
                <>
                  {/* 
                   // @ts-ignore */}
                  <CodeMirror
                    value={
                      state.strategyJSON[state.activeParameter.strategyJSONKey]
                        .parameters[state.activeParameter.key]
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
};

export default ParameterEditor;
