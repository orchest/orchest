import ProjectFilePicker from "@/components/ProjectFilePicker";
import { StepState } from "@/types";
import { hasExtension, join } from "@/utils/path";
import { toValidFilename } from "@/utils/toValidFilename";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  ALLOWED_STEP_EXTENSIONS,
  hasValue,
  kernelNameToLanguage,
} from "@orchest/lib-utils";
import React from "react";
import { SelectEnvironment } from "./SelectEnvironment";
import { useStepDetailsContext } from "./StepDetailsContext";
import { StepParameters } from "./StepParameters";
import { useDelayedSavingStepChanges } from "./useDelayedSavingStepChanges";

const KERNEL_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "julia", label: "Julia" },
  { value: "javascript", label: "JavaScript" },
];

type StepDetailsPropertiesProps = {
  pipelineCwd: string | undefined;
  readOnly: boolean;
  shouldAutoFocus: boolean;
  onSave: (payload: Partial<StepState>, uuid: string) => void;
  menuMaxWidth?: string;
};

export const StepDetailsProperties = ({
  pipelineCwd,
  readOnly,
  shouldAutoFocus,
  onSave,
  menuMaxWidth,
}: StepDetailsPropertiesProps) => {
  const { doesStepFileExist, isCheckingFileValidity } = useStepDetailsContext();
  const { step, setStepChanges } = useDelayedSavingStepChanges(onSave);

  const isNotebookStep = hasExtension(step.file_path, "ipynb");
  const titleInputRef = React.useRef<HTMLInputElement>();

  const onChangeEnvironment = React.useCallback(
    (
      updatedEnvironmentUUID: string,
      updatedEnvironmentName: string,
      skipSave?: boolean
    ) => {
      if (!skipSave) {
        setStepChanges((current) => {
          if (
            pipelineCwd &&
            updatedEnvironmentUUID.length > 0 &&
            hasValue(current.file_path) &&
            current.file_path.length > 0
          ) {
            window.orchest.jupyter?.setNotebookKernel(
              join(pipelineCwd, current.file_path),
              `orchest-kernel-${updatedEnvironmentUUID}`
            );
          }
          return {
            environment: updatedEnvironmentUUID,
            kernel: { ...current.kernel, display_name: updatedEnvironmentName },
          };
        });
      }
    },
    [setStepChanges, pipelineCwd]
  );

  // Mostly for new steps, where user is assumed to start typing Step Title,
  // then Step File Path is then automatically generated.
  const autogenerateFilePath = React.useRef(step.file_path.length === 0);

  const onChangeFilePath = React.useCallback(
    (newFilePath: string) => {
      if (newFilePath.length > 0) {
        autogenerateFilePath.current = false;
      }
      setStepChanges((current) => {
        return newFilePath !== current.file_path
          ? { file_path: newFilePath }
          : current;
      });
    },
    [setStepChanges]
  );

  const onChangeKernel = (updatedKernel: string) => {
    if (step.kernel.name !== updatedKernel)
      setStepChanges({ kernel: { name: updatedKernel } });
  };

  const onChangeTitle = (updatedTitle: string) => {
    const filePathChange = autogenerateFilePath.current
      ? { file_path: toValidFilename(updatedTitle) }
      : null;

    if (step.title !== updatedTitle || filePathChange)
      setStepChanges({ title: updatedTitle, ...filePathChange });
  };

  React.useEffect(() => {
    if (step.file_path.length === 0) {
      onChangeFilePath(toValidFilename(step.title));
    }
  }, [onChangeFilePath, step.file_path.length, step.title]);

  return (
    <Stack direction="column" spacing={3}>
      <TextField
        autoFocus={shouldAutoFocus}
        value={step.title}
        onChange={(event) => onChangeTitle(event.target.value)}
        label="Step name"
        disabled={readOnly}
        fullWidth
        inputRef={titleInputRef}
        data-test-id="step-title-textfield"
      />
      {readOnly ? (
        <TextField
          value={step.file_path}
          label="File path"
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
            onChange={(event) => onChangeKernel(event.target.value)}
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
      <StepParameters isReadOnly={readOnly} onSave={onSave} />
    </Stack>
  );
};
