import { useJobsApi } from "@/api/jobs/useJobsApi";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import produce from "immer";
import React from "react";
import { CodeMirror } from "../../components/common/CodeMirror";
import { useGetJobData } from "../hooks/useGetJobData";
import { useEditJob } from "../stores/useEditJob";

type ParameterEditorProps = {
  parameterKey: string;
  value: string;
  setValue: (value: string) => void;
  isReadOnly: boolean | undefined;
};

const ParameterEditor = ({
  parameterKey,
  value,
  setValue,
  isReadOnly,
}: ParameterEditorProps) => {
  const [codeMirrorValue, setCodeMirrorValue] = React.useState<string>();
  const [isValidJson, setIsValidJson] = React.useState(true);
  const setValueRef = React.useRef(setValue);

  React.useEffect(() => {
    try {
      if (hasValue(codeMirrorValue)) {
        JSON.parse(codeMirrorValue);
        setValueRef.current?.(codeMirrorValue);
      }
      setIsValidJson(true);
    } catch {
      setIsValidJson(false);
    }
  }, [codeMirrorValue]);

  React.useEffect(() => {
    if (!hasValue(codeMirrorValue)) {
      setCodeMirrorValue(value);
    }
  }, [value, codeMirrorValue]);
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
  const setJobChanges = useEditJob((state) => state.setJobChanges);
  const handleChangeParameterStrategy = React.useCallback(
    (strategyKey: string, parameterKey: string, value: string) => {
      // Note that useAutoSaveJob uses shallow compare.
      // Re-create the object in order to trigger auto-saving.
      setJobChanges((state) => {
        const updatedStrategyJson = produce(state.strategy_json, (draft) => {
          const strategy = draft[strategyKey];
          strategy.parameters[parameterKey] = value;
        });
        return { strategy_json: updatedStrategyJson };
      });
    },
    [setJobChanges]
  );

  const jobData = useGetJobData();
  const pipelineFilePath = jobData?.pipeline_run_spec.run_config.pipeline_path;
  const hasLoadedParameterStrategyFile = useJobsApi(
    (state) => state.hasLoadedParameterStrategyFile
  );

  // When updating parameter values, `state.jobChanges.strategy_json` is also updated.
  // But we don't want to re-render the whole form when this happens.
  // Therefore, the predicate `(a, b) => hasValue(a) && hasValue(b)` makes it so
  // that it only re-render when loading state.jobChanges?.strategy_json for the first time.
  const initialStrategyJson = useEditJob(
    (state) => state.jobChanges?.strategy_json,
    (a, b) => hasValue(a) && hasValue(b)
  );

  const shouldRenderPipelineEditor =
    hasValue(hasLoadedParameterStrategyFile) &&
    hasValue(initialStrategyJson) &&
    hasValue(pipelineFilePath);

  return shouldRenderPipelineEditor ? (
    <div>
      {Object.values(initialStrategyJson).map(
        ({ key: strategyKey, title, parameters }) => {
          return (
            <React.Fragment key={strategyKey}>
              <Typography>{title}</Typography>
              {Object.entries(parameters).map(([parameterKey, value]) => {
                return (
                  <ParameterEditor
                    key={`${strategyKey}-${parameterKey}`}
                    isReadOnly={isReadOnly}
                    parameterKey={parameterKey}
                    value={value}
                    setValue={(newValue) => {
                      handleChangeParameterStrategy(
                        strategyKey,
                        parameterKey,
                        newValue
                      );
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        }
      )}
      {isReadOnly && (
        <Typography
          variant="caption"
          sx={{ marginTop: (theme) => theme.spacing(2) }}
        >
          <i>Read only</i>
        </Typography>
      )}
    </div>
  ) : null;
};
