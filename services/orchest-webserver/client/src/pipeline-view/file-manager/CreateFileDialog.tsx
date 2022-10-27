import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useAsync } from "@/hooks/useAsync";
import { FileRoot, unpackPath } from "@/utils/file";
import { join, truncateForDisplay } from "@/utils/path";
import { Checkbox, FormControlLabel } from "@mui/material";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import {
  ALLOWED_STEP_EXTENSIONS,
  FetchError,
  StepExtension,
} from "@orchest/lib-utils";
import React from "react";
import { useForm } from "react-hook-form";
import { prettifyRoot } from "./common";
import { useCreateFile } from "./useCreateFile";

export type CreateFileDialogProps = {
  /** The folder to create the new folder in. */
  cwd: string;
  /** In which root to create the folder. */
  root: FileRoot;
  /** Hide the "create step" section entirely. */
  hideCreateStep?: boolean;
  canCreateStep: boolean;
  isOpen: boolean;
  onClose(): void;
  onSuccess(file: CreatedFile): void;
};

export type FileFormData = {
  fileName: string;
  extension: StepExtension;
  shouldCreateStep: boolean;
};

export type CreatedFile = {
  /** The root the file was created in. */
  root: FileRoot;
  /** The path, relative to the root. */
  path: string;
  /** Whether the user wants to add the file as a step to the pipeline immediately. */
  shouldCreateStep: boolean;
};

const defaultFormState = (canCreateStep: boolean) => ({
  fileName: "",
  extension: ALLOWED_STEP_EXTENSIONS[0],
  shouldCreateStep: canCreateStep,
});

export const CreateFileDialog = ({
  root,
  cwd,
  isOpen,
  hideCreateStep,
  canCreateStep,
  onClose,
  onSuccess,
}: CreateFileDialogProps) => {
  const { setAlert } = useGlobalContext();
  const { register, handleSubmit, watch, reset } = useForm<FileFormData>({
    defaultValues: defaultFormState(canCreateStep),
  });
  const { run, setError, error, status } = useAsync<void>();

  const createFile = useCreateFile(root);

  const onSubmit = React.useCallback(
    async ({ shouldCreateStep, ...file }: FileFormData) => {
      const projectPath = join(cwd, `${file.fileName}.${file.extension}`);

      await run(
        createFile(projectPath)
          .then(unpackPath)
          .then(({ root, path }) => {
            onClose();
            onSuccess({ root, path, shouldCreateStep });
          })
      );
    },
    [cwd, run, createFile, onClose, onSuccess]
  );

  React.useEffect(() => {
    if (isOpen) {
      reset(defaultFormState(canCreateStep));
    }
  }, [reset, isOpen, canCreateStep]);

  const [fileName, extension, shouldCreateStep] = watch([
    "fileName",
    "extension",
    "shouldCreateStep",
  ]);

  const displayPath = truncateForDisplay(
    join(prettifyRoot(root), cwd, `${fileName}.${extension}`)
  );

  React.useEffect(() => {
    if (!error) return;

    const message =
      error instanceof FetchError && error.status === 409 ? (
        `A file named "${fileName}" already exists.`
      ) : (
        <ErrorSummary error={error} />
      );

    setAlert("Error", message, () => {
      setError(null);
      return true;
    });
  }, [error, setAlert, setError, fileName]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      data-test-id="file-manager-create-new-file-dialog"
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit(onSubmit)} id="create-file">
        <DialogTitle>New file</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} paddingTop={(theme) => theme.spacing(2)}>
            <Grid item xs={8}>
              <TextField
                {...register("fileName")}
                label="File name"
                autoFocus
                fullWidth
                data-test-id="file-manager-file-name-textfield"
              />
            </Grid>

            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel id="file-manager-file-extension-label">
                  Extension
                </InputLabel>
                <Select
                  {...register("extension")}
                  value={extension}
                  label="Extension"
                  labelId="file-manager-file-extension-label"
                  id="file-manager-file-extension"
                >
                  {ALLOWED_STEP_EXTENSIONS.map((extension) => (
                    <MenuItem key={extension} value={extension}>
                      .{extension}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="File path"
                value={displayPath}
                disabled
                fullWidth
                margin="normal"
              />
            </Grid>
            {!hideCreateStep && (
              <Grid item xs={12}>
                <FormControlLabel
                  label="Create a new step for this file"
                  title={
                    canCreateStep
                      ? "Add this file as a step in the pipeline directly"
                      : "No pipelines available to add step to"
                  }
                  disabled={!canCreateStep}
                  control={
                    <Checkbox
                      {...register("shouldCreateStep")}
                      checked={shouldCreateStep}
                    />
                  }
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose} tabIndex={-1}>
            Cancel
          </Button>
          <Button
            variant="contained"
            type="submit"
            form="create-file"
            disabled={status === "PENDING"}
            data-test-id="file-manager-create-file"
          >
            Save file
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
