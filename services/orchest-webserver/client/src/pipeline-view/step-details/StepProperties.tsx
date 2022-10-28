import { FilePicker } from "@/components/FilePicker";
import { StepState } from "@/types";
import { FileRoot, UnpackedPath } from "@/utils/file";
import {
  addLeadingSlash,
  basename,
  hasExtension,
  join,
  relative,
} from "@/utils/path";
import { pick } from "@/utils/record";
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
import { StepParameters } from "./StepParameters";
import { useAutoFocusStepName } from "./store/useAutoFocusStepName";
import { useDelayedSavingStepChanges } from "./useDelayedSavingStepChanges";

const KERNEL_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "julia", label: "Julia" },
  { value: "javascript", label: "JavaScript" },
];

type StepPropertiesProps = {
  pipelineCwd: string | undefined;
  readOnly: boolean;
  onSave: (payload: Partial<StepState>, uuid: string) => void;
  stepInputRef: React.MutableRefObject<HTMLInputElement | undefined>;
};

export const StepProperties = ({
  pipelineCwd,
  readOnly,
  onSave,
  stepInputRef,
}: StepPropertiesProps) => {
  const { shouldAutoFocusStepName } = useAutoFocusStepName();
  const handleSave = React.useCallback(
    (payload: Partial<StepState>, uuid: string) => {
      const changes = pick(
        payload,
        "file_path",
        "environment",
        "title",
        "parameters"
      );

      onSave(changes, uuid);
    },
    [onSave]
  );

  const { step, setStepChanges } = useDelayedSavingStepChanges(handleSave);

  const isNotebookStep = hasExtension(step.file_path, "ipynb");
  const titleInputRef = React.useRef<HTMLInputElement>();
  if (stepInputRef) {
    stepInputRef.current = titleInputRef.current;
  }

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
    (root: FileRoot, path: string) => {
      if (path.length > 0) {
        autogenerateFilePath.current = false;
      }

      setStepChanges((current) => ({
        file_path: toPipelinePath({ root, path }, pipelineCwd ?? "/"),
        title: current.title || basename(path).split(".")[0],
      }));
    },
    [pipelineCwd, setStepChanges]
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
      onChangeFilePath("/project-dir", toValidFilename(step.title));
    }
  }, [onChangeFilePath, step.file_path.length, step.title]);

  const { root, path } = toProjectPath(step.file_path, pipelineCwd ?? "/");

  return (
    <Stack direction="column" spacing={3}>
      <TextField
        autoFocus={shouldAutoFocusStepName}
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
          value={path}
          label="File path"
          disabled={readOnly}
          fullWidth
          margin="normal"
          data-test-id="step-file-name-textfield"
        />
      ) : (
        <FilePicker
          root={root}
          selected={path}
          fileFilter={(path) => hasExtension(path, ...ALLOWED_STEP_EXTENSIONS)}
          onChange={(root, newPath) => onChangeFilePath(root, newPath)}
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
        language={kernelNameToLanguage(step.kernel.name || "")}
        onChange={onChangeEnvironment}
      />
      <StepParameters isReadOnly={readOnly} setStepChanges={setStepChanges} />
    </Stack>
  );
};

const toPipelinePath = (
  { root, path }: UnpackedPath,
  pipelineCwd: string
): string =>
  root === "/data" ? join(root, path) : relative(pipelineCwd, path);

const toProjectPath = (path: string, pipelineCwd: string): UnpackedPath =>
  path.startsWith("/data/")
    ? { root: "/data", path: path.substring("/data".length) }
    : { root: "/project-dir", path: addLeadingSlash(join(pipelineCwd, path)) };
