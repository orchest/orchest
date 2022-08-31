import { StrategyJson } from "@/types";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { ParamTree } from "../ParamTree";

interface IParameterEditorProps {
  strategyJSON: StrategyJson | undefined;
  pipelineName: string;
  readOnly?: boolean;
  onParameterChange?: (value: StrategyJson) => void;
}

const LegacyParameterEditor: React.FC<IParameterEditorProps> = (props) => {
  const [strategyJSON, setStrategyJson] = React.useState<StrategyJson>(
    props.strategyJSON || {}
  );

  const [activeParameter, setActiveParameter] = React.useState<
    | {
        key: string;
        strategyJSONKey: string;
      }
    | undefined
  >(undefined);

  const [codeMirrorValue, setCodeMirrorValue] = React.useState("");

  const editParameter = (key: string, strategyJSONKey: string) => {
    setActiveParameter({ key, strategyJSONKey });
    setCodeMirrorValue(strategyJSON[strategyJSONKey].parameters[key]);
  };

  const isJsonValid = React.useMemo(() => {
    try {
      if (codeMirrorValue) JSON.parse(codeMirrorValue);
      return true;
    } catch {
      return false;
    }
  }, [codeMirrorValue]);

  React.useEffect(() => {
    // By default open editor for first key
    try {
      let strategyKeys = Object.keys(strategyJSON);
      if (strategyKeys.length > 0) {
        let firstKey = strategyKeys[0];
        let parameterKeys = Object.keys(strategyJSON[firstKey].parameters);
        if (parameterKeys.length > 0) {
          editParameter(parameterKeys[0], firstKey);
        }
      }
    } catch {
      // In case something is wrong with the strategyJSON object
      // don't break.
    }
  }, []);

  const codeMirrorRef = React.useRef<CodeMirror | null>(null);
  React.useEffect(() => {
    if (activeParameter) {
      // `editor` is not defined in CodeMirror. So we need this workaround.
      (codeMirrorRef.current as any)?.editor?.focus(); // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  }, [activeParameter]);

  return (
    <div className="parameter-editor">
      <div className="columns">
        <div className="column">
          <ParamTree
            pipelineName={props.pipelineName}
            strategyJson={strategyJSON}
            editParameter={editParameter}
            activeParameter={activeParameter}
            data-test-id={props["data-test-id"]}
          />
        </div>
        <div className="column">
          {hasValue(activeParameter) && !props.readOnly && (
            <>
              <CodeMirror
                ref={codeMirrorRef}
                value={codeMirrorValue}
                options={{
                  mode: "application/json",
                  theme: "jupyter",
                  lineNumbers: true,
                  autofocus: true,
                }}
                onBeforeChange={(editor, data, value) => {
                  setStrategyJson((json) => {
                    json[activeParameter.strategyJSONKey].parameters[
                      activeParameter.key
                    ] = value;
                    setCodeMirrorValue(value);

                    // Only call onParameterChange if valid JSON Array.
                    // Put this block into event-loop to speed up the typing.
                    window.setTimeout(() => {
                      try {
                        if (Array.isArray(JSON.parse(value))) {
                          props.onParameterChange?.(json);
                        }
                      } catch {
                        console.warn("Invalid JSON entered");
                      }
                    }, 0);

                    return json;
                  });
                }}
              />
              {!isJsonValid && (
                <Alert
                  severity="warning"
                  sx={{ marginTop: (theme) => theme.spacing(2) }}
                >
                  Your input is not valid JSON.
                </Alert>
              )}
            </>
          )}
          {activeParameter !== undefined && props.readOnly === true && (
            <>
              <CodeMirror
                onBeforeChange={() => null}
                value={codeMirrorValue}
                options={{
                  mode: "application/json",
                  theme: "jupyter",
                  lineNumbers: true,
                }}
              />
              <Typography
                variant="caption"
                sx={{ marginTop: (theme) => theme.spacing(2) }}
              >
                <i>Read only</i>
              </Typography>
            </>
          )}
        </div>
        <div className="clear"></div>
      </div>
    </div>
  );
};

export default LegacyParameterEditor;
