import { useLocalStorage } from "@/hooks/useLocalStorage";
import { JsonSchemaType } from "@/hooks/useOpenSchemaFile";
import { Json } from "@/types";
import { isValidJson } from "@/utils/isValidJson";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import {
  materialCells,
  materialRenderers,
} from "@jsonforms/material-renderers";
import { JsonForms } from "@jsonforms/react";
import { styled } from "@mui/material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import {
  NoSchemaFile,
  NoSchemaPropertiesDefined,
} from "../pipeline-view/step-details/NoJsonFormMessage";
import {
  ParametersActions,
  ParametersActionsMenuItem,
  ParameterViewingMode,
} from "./ParametersActions";

type ParameterEditorWithJsonFormProps = {
  initialValue: Json;
  isReadOnly: boolean;
  onSave: (parameters: Record<string, Json> | undefined) => void;
  parameterSchema: JsonSchema | undefined;
  parameterUiSchema: UISchemaElement | undefined;
  openSchemaFile: (e: React.MouseEvent, type: JsonSchemaType) => void;
  menuItems?: ParametersActionsMenuItem[];
};

/**
 * Overwrite the styling of materialRenderers.
 */
const JsonFormContainer = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  ".MuiTypography-h6": { fontSize: theme.typography.body2.fontSize },
  ".MuiTableCell-root": { paddingLeft: 0 },
}));

export const ParameterEditorWithJsonForm = ({
  initialValue,
  isReadOnly,
  onSave,
  parameterSchema,
  parameterUiSchema,
  openSchemaFile,
  menuItems,
}: ParameterEditorWithJsonFormProps) => {
  const [viewingMode, setViewingMode] = useLocalStorage<ParameterViewingMode>(
    "stepParametersViewingMode",
    "json"
  );

  const [editableParameters, setEditableParameters] = React.useState<
    string | undefined
  >(JSON.stringify(initialValue, null, 2));

  const [parametersData, setParametersData] = React.useState<Json | undefined>(
    initialValue
  );

  React.useEffect(() => {
    setEditableParameters(JSON.stringify(initialValue, null, 2));
  }, [initialValue]);

  const selectView = React.useCallback(
    (value: ParameterViewingMode) => {
      setViewingMode(value);
      // Note: this is a dirty workaround.
      // JsonForm is not a controlled component, and its data instantiation is hard to predict.
      // It seems that, `data` needs to set to undefined when it's mounted, then it will pick up new value.

      // Set the state to undefined. If JsonForms is mounted in this render, it will pick up new value.
      setEditableParameters(undefined);
      setParametersData(undefined);
      window.setTimeout(() => {
        // Use an eventloop to break the batch rendering, and set the states in the next re-render.
        setEditableParameters(JSON.stringify(initialValue, null, 2));
        setParametersData(initialValue);
      }, 0);
    },
    [initialValue, setViewingMode]
  );

  const onChangeParameterJSON = (updatedParameterJsonString: string) => {
    setEditableParameters(updatedParameterJsonString);
    try {
      const parsedData =
        updatedParameterJsonString.trim() === ""
          ? undefined
          : JSON.parse(updatedParameterJsonString);
      onSave(parsedData);
      setParametersData(parsedData);
    } catch (err) {}
  };

  const onChangeParameterData = (data: Record<string, Json>) => {
    setEditableParameters(JSON.stringify(data, null, 2));
    try {
      onSave(data);
      setParametersData(data);
    } catch (err) {}
  };

  const isParametersValidJson = React.useMemo(() => {
    if (!editableParameters) return true;
    return isValidJson(editableParameters);
  }, [editableParameters]);

  const isSchemaDefined =
    parameterSchema?.properties &&
    Object.keys(parameterSchema?.properties).length > 0;

  const prettifyInputParameters = () => {
    setEditableParameters((value) => {
      if (!hasValue(value)) return value;

      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch (error) {
        return value;
      }
    });
  };

  const isUiSchemaDefined =
    hasValue(parameterUiSchema) && Object.keys(parameterUiSchema).length > 0;

  return (
    <Stack direction="column" spacing={2}>
      <Typography
        component="h3"
        variant="subtitle2"
        sx={{ marginBottom: (theme) => theme.spacing(1) }}
      >
        Parameters
      </Typography>
      <ParametersActions
        viewingMode={viewingMode}
        setViewingMode={selectView}
        parameterSchema={parameterSchema}
        parameterUiSchema={parameterUiSchema}
        openSchemaFile={openSchemaFile}
        menuItems={menuItems}
      />
      {viewingMode === "json" && (
        <>
          <CodeMirror
            value={editableParameters || ""}
            options={{
              mode: "application/json",
              theme: "jupyter",
              lineNumbers: true,
              readOnly: isReadOnly,
            }}
            onBlur={prettifyInputParameters}
            onBeforeChange={(editor, data, value) => {
              onChangeParameterJSON(value);
            }}
          />
          {!isParametersValidJson && (
            <Alert severity="warning">Your input is not valid JSON.</Alert>
          )}
        </>
      )}
      {viewingMode === "form" &&
        (!hasValue(parameterSchema) ? (
          <NoSchemaFile openSchemaFile={openSchemaFile} />
        ) : !isSchemaDefined ? (
          <NoSchemaPropertiesDefined openSchemaFile={openSchemaFile} />
        ) : (
          <JsonFormContainer>
            <JsonForms
              readonly={isReadOnly}
              schema={parameterSchema}
              uischema={isUiSchemaDefined ? parameterUiSchema : undefined}
              data={parametersData}
              renderers={materialRenderers}
              cells={materialCells}
              onChange={({ data }) => {
                if (data) onChangeParameterData(data);
              }}
            />
          </JsonFormContainer>
        ))}
    </Stack>
  );
};
