import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from "@/components/Accordion";
import { useTheme } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import produce from "immer";
import React from "react";
import { CodeMirror } from "../../components/common/CodeMirror";
import { useValidJobQueryArgs } from "../hooks/useValidJobQueryArgs";
import { useEditJob } from "../stores/useEditJob";

const useCodeMirrorValue = (strategyKey: string, parameterKey: string) => {
  const [codeMirrorValue, setCodeMirrorValue] = React.useState<
    string | undefined
  >();

  const { jobUuid } = useValidJobQueryArgs();
  const loadedStrategyFilePath = useEditJob(
    (state) => state.jobChanges?.loadedStrategyFilePath
  );

  React.useEffect(() => {
    // Reset codeMirrorValue when jobUuid is not undefined, i.e. redirect has ended.
    // Without this if condition, codeMirrorValue will still be set to the old value
    // because jobChanges is not yet reset to undefined.
    if (jobUuid) setCodeMirrorValue(undefined);
  }, [jobUuid, loadedStrategyFilePath]);

  const value = useEditJob(
    (state) =>
      state.jobChanges?.strategy_json[strategyKey]?.parameters[parameterKey]
  );

  const shouldInitiateCodeMirrorValue = !hasValue(codeMirrorValue);
  React.useEffect(() => {
    if (shouldInitiateCodeMirrorValue) setCodeMirrorValue(value);
  }, [value, shouldInitiateCodeMirrorValue]);

  return [codeMirrorValue, setCodeMirrorValue] as const;
};

type JobParameterEditorProps = {
  strategyKey: string;
  parameterKey: string;
  isReadOnly: boolean | undefined;
};

export const JobParameterEditor = ({
  strategyKey,
  parameterKey,
  isReadOnly,
}: JobParameterEditorProps) => {
  const [codeMirrorValue, setCodeMirrorValue] = useCodeMirrorValue(
    strategyKey,
    parameterKey
  );
  const [isValidJson, setIsValidJson] = React.useState(true);

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

  const theme = useTheme();

  return (
    <Accordion sx={{ marginLeft: (theme) => theme.spacing(3) }}>
      <AccordionSummary>
        <Typography variant="body1">{`${parameterKey}: ${codeMirrorValue}`}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        {hasValue(codeMirrorValue) && (
          <Box sx={{ margin: (theme) => theme.spacing(2, 0) }}>
            <CodeMirror
              borderColor={theme.borderColor}
              value={codeMirrorValue}
              options={{
                mode: "application/json",
                theme: "jupyter",
                lineNumbers: true,
                autofocus: false,
                readOnly: isReadOnly,
              }}
              onBeforeChange={(editor, data, value) =>
                setCodeMirrorValue(value)
              }
            />
          </Box>
        )}
        {!isValidJson && (
          <Alert
            severity="warning"
            sx={{ marginTop: (theme) => theme.spacing(2) }}
          >
            Invalid JSON
          </Alert>
        )}
      </AccordionDetails>
    </Accordion>
  );
};
