import { OrderableList } from "@/components/OrderableList";
import ProjectFilePicker from "@/components/ProjectFilePicker";
import { Step } from "@/types";
import { isValidJson } from "@/utils/isValidJson";
import { hasExtension, join } from "@/utils/path";
import { toValidFilename } from "@/utils/toValidFilename";
import DragIndicator from "@mui/icons-material/DragIndicator";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  ALLOWED_STEP_EXTENSIONS,
  kernelNameToLanguage,
  RefManager,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { SelectEnvironment } from "./SelectEnvironment";
import { useStepDetailsContext } from "./StepDetailsContext";

export type ConnectionDict = Record<
  string,
  { title: string; file_path: string }
>;

const ConnectionItem = ({
  uuid,
  title,
  filePath,
}: {
  uuid: string;
  title: string;
  filePath: string;
}) => {
  return (
    <div className="connection-item" data-uuid={uuid}>
      <span>{title}</span> <span className="filename">({filePath})</span>
    </div>
  );
};

const KERNEL_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "julia", label: "Julia" },
  { value: "javascript", label: "JavaScript" },
];

export const StepDetailsProperties = ({
  pipelineCwd,
  readOnly,
  shouldAutoFocus,
  onSave,
  menuMaxWidth,
}: {
  pipelineCwd: string | undefined;
  readOnly: boolean;
  shouldAutoFocus: boolean;
  onSave: (
    payload: Partial<Step>,
    uuid: string,
    replace?: boolean
  ) => Promise<void>;
  menuMaxWidth?: string;
}) => {
  const { step, connections } = useStepDetailsContext();
  // Allows user to edit JSON while typing the text will not be valid JSON.
  const [editableParameters, setEditableParameters] = React.useState(
    JSON.stringify(step.parameters, null, 2)
  );

  const refManager = React.useMemo(() => new RefManager(), []);

  const isNotebookStep = hasExtension(step.file_path, "ipynb");

  const onChangeEnvironment = React.useCallback(
    (
      updatedEnvironmentUUID: string,
      updatedEnvironmentName: string,
      skipSave?: boolean
    ) => {
      if (!skipSave) {
        onSave(
          {
            environment: updatedEnvironmentUUID,
            kernel: { display_name: updatedEnvironmentName },
          },
          step.uuid,
          false
        );
        if (
          pipelineCwd &&
          updatedEnvironmentUUID.length > 0 &&
          step.file_path.length > 0
        ) {
          window.orchest.jupyter?.setNotebookKernel(
            join(pipelineCwd, step.file_path),
            `orchest-kernel-${updatedEnvironmentUUID}`
          );
        }
      }
    },
    [onSave, pipelineCwd, step]
  );

  // Mostly for new steps, where user is assumed to start typing Step Title,
  // then Step File Path is then automatically generated.
  const autogenerateFilePath = React.useRef(step.file_path.length === 0);

  const onChangeFilePath = React.useCallback(
    (newFilePath: string) => {
      if (newFilePath.length > 0) {
        autogenerateFilePath.current = false;
      }
      if (newFilePath !== step.file_path)
        onSave({ file_path: newFilePath }, step.uuid);
    },
    [onSave, step.uuid, step.file_path]
  );

  const onChangeParameterJSON = (updatedParameterJSON: string) => {
    setEditableParameters(updatedParameterJSON);
    try {
      onSave({ parameters: JSON.parse(updatedParameterJSON) }, step.uuid, true);
    } catch (err) {}
  };

  const onChangeKernel = (updatedKernel: string) => {
    if (step.kernel.name !== updatedKernel)
      onSave({ kernel: { name: updatedKernel } }, step.uuid);
  };

  const onChangeTitle = (updatedTitle: string) => {
    const filePathChange = autogenerateFilePath.current
      ? { file_path: toValidFilename(updatedTitle) }
      : null;

    if (step.title !== updatedTitle || filePathChange)
      onSave({ title: updatedTitle, ...filePathChange }, step.uuid);
  };

  const swapConnectionOrder = (
    oldConnectionIndex: number,
    newConnectionIndex: number
  ) => {
    // check if there is work to do
    if (oldConnectionIndex !== newConnectionIndex) {
      // note it's creating a reference
      const connections = [...step.incoming_connections];

      let tmp = connections[oldConnectionIndex];
      connections.splice(oldConnectionIndex, 1);
      connections.splice(newConnectionIndex, 0, tmp);

      onSave({ incoming_connections: connections }, step.uuid);
    }
  };

  React.useEffect(() => {
    if (!readOnly) {
      // set focus on first field
      refManager.refs.titleTextField.focus();
    }
    if (step.file_path.length === 0) {
      onChangeFilePath(toValidFilename(step.title));
    }
  }, []);

  const isParametersValidJson = React.useMemo(() => {
    return isValidJson(editableParameters);
  }, [editableParameters]);

  const { doesStepFileExist, isCheckingFileValidity } = useStepDetailsContext();

  return (
    <div className={"detail-subview"}>
      <Stack direction="column" spacing={3}>
        <TextField
          autoFocus={shouldAutoFocus}
          value={step.title}
          onChange={(e) => onChangeTitle(e.target.value)}
          label="Title"
          disabled={readOnly}
          fullWidth
          ref={refManager.nrefs.titleTextField}
          data-test-id="step-title-textfield"
        />
        {readOnly ? (
          <TextField
            value={step.file_path}
            label="File name"
            disabled={readOnly}
            fullWidth
            margin="normal"
            data-test-id="step-file-name-textfield"
          />
        ) : (
          <ProjectFilePicker
            value={step.file_path}
            allowedExtensions={ALLOWED_STEP_EXTENSIONS}
            pipelineCwd={pipelineCwd}
            onChange={onChangeFilePath}
            menuMaxWidth={menuMaxWidth}
            doesFileExist={doesStepFileExist}
            isCheckingFileValidity={isCheckingFileValidity}
          />
        )}
        {isNotebookStep && (
          <FormControl fullWidth>
            <InputLabel id="kernel-language-label">Kernel language</InputLabel>
            <Select
              label="Kernel language"
              labelId="kernel-language-label"
              id="kernel-language"
              value={step.kernel.name}
              disabled={readOnly}
              onChange={(e) => onChangeKernel(e.target.value)}
            >
              {KERNEL_OPTIONS.map((option) => {
                return (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
        <SelectEnvironment
          value={step.environment}
          disabled={readOnly}
          queryString={
            isNotebookStep
              ? `?language=${kernelNameToLanguage(step.kernel.name)}`
              : ""
          }
          onChange={onChangeEnvironment}
        />
        <Box>
          <Typography
            component="h3"
            variant="subtitle2"
            sx={{ marginBottom: (theme) => theme.spacing(1) }}
          >
            Parameters
          </Typography>
          <CodeMirror
            value={editableParameters}
            options={{
              mode: "application/json",
              theme: "jupyter",
              lineNumbers: true,
              readOnly: readOnly === true, // not sure whether CodeMirror accepts 'falsy' values
            }}
            onBeforeChange={(editor, data, value) => {
              onChangeParameterJSON(value);
            }}
          />
          {!isParametersValidJson && (
            <Alert severity="warning">Your input is not valid JSON.</Alert>
          )}
        </Box>

        {step.incoming_connections.length != 0 && (
          <Box>
            <Typography
              component="h3"
              variant="subtitle2"
              sx={{ marginBottom: (theme) => theme.spacing(1) }}
            >
              Connections
            </Typography>

            <OrderableList
              onUpdate={async (oldIndex, newIndex) =>
                swapConnectionOrder(oldIndex, newIndex)
              }
            >
              {step.incoming_connections.map((startNodeUUID: string) => (
                <Stack
                  flexDirection="row"
                  key={startNodeUUID}
                  sx={{
                    backgroundColor: (theme) =>
                      `${theme.palette.background.paper}`,
                    width: "100%",
                  }}
                >
                  <DragIndicator />
                  <ConnectionItem
                    title={connections[startNodeUUID].title}
                    filePath={connections[startNodeUUID].file_path}
                    uuid={startNodeUUID}
                    key={startNodeUUID}
                  />
                </Stack>
              ))}
            </OrderableList>
          </Box>
        )}
      </Stack>
    </div>
  );
};
