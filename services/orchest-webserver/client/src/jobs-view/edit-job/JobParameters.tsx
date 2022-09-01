import { useGlobalContext } from "@/contexts/GlobalContext";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { hasValue, uuidv4 } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import produce from "immer";
import React from "react";
import { CodeMirror } from "../../components/common/CodeMirror";
import { useEditJob } from "../stores/useEditJob";

type ParameterEditorProps = {
  strategyKey: string;
  parameterKey: string;
  isReadOnly: boolean | undefined;
};

const ParameterEditor = ({
  strategyKey,
  parameterKey,
  isReadOnly,
}: ParameterEditorProps) => {
  const [codeMirrorValue, setCodeMirrorValue] = React.useState<string>();
  const [isValidJson, setIsValidJson] = React.useState(true);

  const value = useEditJob(
    (state) =>
      state.jobChanges?.strategy_json[strategyKey]?.parameters[parameterKey]
  );

  React.useEffect(() => {
    if (!hasValue(codeMirrorValue)) {
      setCodeMirrorValue(value);
    }
  }, [value, codeMirrorValue]);

  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const setValue = React.useCallback(
    (newValue: string) => {
      setJobChanges((state) => {
        const updatedStrategyJson = produce(state.strategy_json, (draft) => {
          const strategy = draft[strategyKey];
          strategy.parameters[parameterKey] = newValue;
        });
        return { strategy_json: updatedStrategyJson };
      });
    },
    [setJobChanges, strategyKey, parameterKey]
  );

  React.useEffect(() => {
    try {
      if (hasValue(codeMirrorValue)) {
        JSON.parse(codeMirrorValue);
        setValue(codeMirrorValue);
      }
      setIsValidJson(true);
    } catch (error) {
      setIsValidJson(false);
    }
  }, [codeMirrorValue, setValue]);

  return (
    <>
      <Typography>{`${parameterKey}: ${codeMirrorValue}`}</Typography>
      {hasValue(codeMirrorValue) && (
        <CodeMirror
          value={codeMirrorValue}
          options={{
            mode: "application/json",
            theme: "jupyter",
            lineNumbers: true,
            autofocus: false,
          }}
          onBeforeChange={
            isReadOnly
              ? () => null
              : (editor, data, value) => setCodeMirrorValue(value)
          }
        />
      )}
      {!isValidJson && (
        <Alert
          severity="warning"
          sx={{ marginTop: (theme) => theme.spacing(2) }}
        >
          Invalid JSON
        </Alert>
      )}
    </>
  );
};

type JobParametersProps = {
  isReadOnly: boolean | undefined;
};

export const JobParameters = ({ isReadOnly }: JobParametersProps) => {
  const loadedStrategyFilePath = useEditJob(
    (state) => state.jobChanges?.loadedStrategyFilePath
  );

  const hash = React.useMemo(() => uuidv4(), [loadedStrategyFilePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // When updating parameter values, `state.jobChanges.strategy_json` is also updated.
  // But we don't want to re-render the whole form when this happens.
  // Therefore, in `equals` function, check if existingStrategy is still empty.
  // Don't re-render if it already has properties.
  const initialStrategyJson = useEditJob(
    (state) => state.jobChanges?.strategy_json,
    (existingStrategy = {}) => {
      const existingStrategyKeys = Object.keys(existingStrategy);
      return existingStrategyKeys.length > 0;
    }
  );

  const { config } = useGlobalContext();
  const reservedKey = config?.PIPELINE_PARAMETERS_RESERVED_KEY || "";
  const parameters = React.useMemo(() => {
    if (!initialStrategyJson || !reservedKey) return;
    const { [reservedKey]: pipelineParams, ...rest } = initialStrategyJson;
    return pipelineParams
      ? [pipelineParams, ...Object.values(rest)]
      : Object.values(rest);
  }, [initialStrategyJson, reservedKey]);

  const shouldRenderPipelineEditor = hasValue(parameters);

  return shouldRenderPipelineEditor ? (
    <div>
      {parameters.map(({ key: strategyKey, title, parameters }) => {
        return (
          <React.Fragment key={`${hash}-${strategyKey}`}>
            <Typography key={`${hash}-title`} sx={{ border: "1px dotted red" }}>
              {title || "(Unnamed step)"}
            </Typography>
            {Object.keys(parameters).map((parameterKey) => {
              return (
                <ParameterEditor
                  key={`${hash}-${strategyKey}-${parameterKey}`}
                  isReadOnly={isReadOnly}
                  strategyKey={strategyKey}
                  parameterKey={parameterKey}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  ) : null;
};
