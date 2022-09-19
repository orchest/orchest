import { StrategyJson } from "@/types";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { CodeMirror } from "./common/CodeMirror";
import { ParamTree } from "./ParamTree";

interface ParameterEditorProps {
  strategyJson: StrategyJson | undefined;
  pipelineFilePath: string;
  readOnly?: boolean;
  onParameterChange?: (value: StrategyJson) => void;
  disableAutofocusCodeMirror?: boolean;
  "data-test-id": string;
}

export const ParameterEditor = ({
  disableAutofocusCodeMirror,
  onParameterChange,
  readOnly,
  pipelineFilePath,
  strategyJson: initialStrategyJson = {},
  "data-test-id": dataTestId,
}: ParameterEditorProps) => {
  const [strategyJson, setStrategyJson] = React.useState<StrategyJson>(
    initialStrategyJson
  );

  const [activeParameter, setActiveParameter] = React.useState<string>();

  const [codeMirrorValue, setCodeMirrorValue] = React.useState("");

  const editParameter = React.useCallback(
    (key: string, strategyJsonKey: string) => {
      setActiveParameter([key, strategyJsonKey].join("|"));
      setCodeMirrorValue(strategyJson[strategyJsonKey].parameters[key]);
    },
    [strategyJson]
  );

  const isJsonValid = React.useMemo(() => {
    try {
      if (codeMirrorValue) JSON.parse(codeMirrorValue);
      return true;
    } catch {
      return false;
    }
  }, [codeMirrorValue]);

  React.useEffect(() => {
    try {
      const strategyKeys = Object.keys(strategyJson);
      if (strategyKeys.length > 0) {
        const firstKey = strategyKeys[0];
        const parameterKeys = Object.keys(strategyJson[firstKey].parameters);
        if (parameterKeys.length > 0) {
          editParameter(parameterKeys[0], firstKey);
        }
      }
    } catch {}
  }, [editParameter, strategyJson]);

  return (
    <div className="parameter-editor">
      <div className="columns">
        <div className="column">
          <ParamTree
            pipelineName={pipelineFilePath}
            strategyJson={strategyJson}
            selectParameter={editParameter}
            activeParameter={activeParameter}
            data-test-id={dataTestId}
          />
        </div>
        <div className="column">
          {hasValue(activeParameter) && !readOnly && (
            <>
              <CodeMirror
                value={codeMirrorValue}
                options={{
                  mode: "application/json",
                  theme: "jupyter",
                  lineNumbers: true,
                  autofocus: !disableAutofocusCodeMirror,
                }}
                onBeforeChange={(editor, data, value) => {
                  const [key, strategyJsonKey] = activeParameter.split("|");
                  setStrategyJson((json) => {
                    json[strategyJsonKey].parameters[key] = value;
                    setCodeMirrorValue(value);

                    // Put this block into event-loop to speed up the typing.
                    window.setTimeout(() => {
                      try {
                        if (Array.isArray(JSON.parse(value))) {
                          onParameterChange?.(json);
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
          {activeParameter !== undefined && readOnly === true && (
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
