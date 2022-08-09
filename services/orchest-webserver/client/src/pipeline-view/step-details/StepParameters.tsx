import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Json, Step } from "@/types";
import { isValidJson } from "@/utils/isValidJson";
import {
  materialCells,
  materialRenderers,
} from "@jsonforms/material-renderers";
import { JsonForms } from "@jsonforms/react";
import { styled } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { useStepDetailsContext } from "./StepDetailsContext";

type StepParametersProps = {
  isReadOnly: boolean;
  onSave: (payload: Partial<Step>, uuid: string, replace?: boolean) => void;
};

/**
 * Overwrite the styling of materialRenderers.
 */
const JsonFormContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  ".MuiTypography-h6": { fontSize: theme.typography.body2.fontSize },
  ".MuiTableCell-root": { paddingLeft: 0 },
}));

type StepParameterViewingMode = "json" | "form";

export const StepParameters = ({ isReadOnly, onSave }: StepParametersProps) => {
  const { step, parameterSchema, parameterUiSchema } = useStepDetailsContext();

  const [viewingMode, setViewingMode] = useLocalStorage<
    StepParameterViewingMode
  >("stepParametersViewingMode", "json");

  const [editableParameters, setEditableParameters] = React.useState(
    JSON.stringify(step.parameters, null, 2)
  );

  const [parametersData, setParametersData] = React.useState(step.parameters);

  const onChangeParameterJSON = (updatedParameterJSON: string) => {
    setEditableParameters(updatedParameterJSON);
    try {
      onSave({ parameters: JSON.parse(updatedParameterJSON) }, step.uuid, true);
      setParametersData(JSON.parse(updatedParameterJSON));
    } catch (err) {}
  };

  const onChangeParameterData = (data: Record<string, Json>) => {
    setEditableParameters(JSON.stringify(data, null, 2));
    try {
      onSave({ parameters: data }, step.uuid, true);
    } catch (err) {}
  };

  const isParametersValidJson = React.useMemo(() => {
    return isValidJson(editableParameters);
  }, [editableParameters]);

  return (
    <Box>
      <Typography
        component="h3"
        variant="subtitle2"
        sx={{ marginBottom: (theme) => theme.spacing(1) }}
      >
        Parameters
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Step parameters viewing mode"
        value={viewingMode}
        onChange={(e, value) => setViewingMode(value)}
      >
        <ToggleButton value="json" disabled={viewingMode === "json"}>
          Json
        </ToggleButton>
        <ToggleButton value="form" disabled={viewingMode === "form"}>
          Form
        </ToggleButton>
      </ToggleButtonGroup>
      {viewingMode === "json" && (
        <>
          <CodeMirror
            value={editableParameters}
            options={{
              mode: "application/json",
              theme: "jupyter",
              lineNumbers: true,
              readOnly: isReadOnly === true,
            }}
            onBeforeChange={(editor, data, value) => {
              onChangeParameterJSON(value);
            }}
          />
          {!isParametersValidJson && (
            <Alert severity="warning">Your input is not valid JSON.</Alert>
          )}
        </>
      )}
      {viewingMode === "form" && parameterSchema && (
        <JsonFormContainer>
          <JsonForms
            readonly={isReadOnly}
            schema={parameterSchema}
            uischema={parameterUiSchema}
            data={parametersData}
            renderers={materialRenderers}
            cells={materialCells}
            onChange={({ data }) => onChangeParameterData(data)}
          />
        </JsonFormContainer>
      )}
    </Box>
  );
};
