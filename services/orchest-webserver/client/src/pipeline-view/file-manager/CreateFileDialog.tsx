import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import { Checkbox } from "@mui/material";
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
import { ALLOWED_STEP_EXTENSIONS, StepExtension } from "@orchest/lib-utils";
import React from "react";
import { useForm } from "react-hook-form";
import { FileManagementRoot } from "../common";
import { lastSelectedFolderPath, prettifyRoot } from "./common";
import { useFileManagerContext } from "./FileManagerContext";
import { useCreateFile } from "./useCreateFile";

export type CreateFileDialogProps = {
  isOpen: boolean;
  root?: FileManagementRoot;
  onClose(): void;
  onSuccess(file: CreatedFile): void;
};

export type FileFormData = {
  fileName: string;
  extension: StepExtension;
  createStep: boolean;
};

export type CreatedFile = {
  /** The path, relative to `/project-dir:/`. */
  projectPath: string;
  /** The path, starting with `/project-dir:/`. */
  fullPath: string;
  /** Whether the user wants to add the file as a step to the pipeline immediately. */
  createStep: boolean;
};

const DEFAULT_FORM_STATE: FileFormData = {
  fileName: "",
  extension: ALLOWED_STEP_EXTENSIONS[0],
  createStep: true,
};

const combinePath = (
  dirName: string,
  fileName: string,
  extension: StepExtension
) => `${dirName}${fileName}.${extension}`;

export const CreateFileDialog = ({
  isOpen,
  root = "/project-dir",
  onClose,
  onSuccess,
}: CreateFileDialogProps) => {
  const { setAlert } = useAppContext();
  const { selectedFiles } = useFileManagerContext();
  const { register, handleSubmit, watch } = useForm<FileFormData>({
    defaultValues: DEFAULT_FORM_STATE,
  });
  const { run, setError, error, status } = useAsync<string>();

  const selectedFolder = React.useMemo(
    () => lastSelectedFolderPath(selectedFiles),
    [selectedFiles]
  );

  const createFile = useCreateFile(root);

  const onSubmit = async ({ createStep, ...file }: FileFormData) => {
    const projectPath = combinePath(
      selectedFolder,
      file.fileName,
      file.extension
    );

    await run(createFile(projectPath))
      .then((fullPath) => {
        onSuccess({ projectPath, fullPath, createStep });
        onClose();
      })
      .catch((error) => setAlert("Failed to create file", String(error)));
  };

  React.useEffect(() => {
    if (error) {
      setAlert("Failed to create file", String(error), (resolve) => {
        setError(null);
        resolve(true);
        return true;
      });
    }
  }, [setAlert, setError, error]);

  const [fileName, extension, createStep] = watch([
    "fileName",
    "extension",
    "createStep",
  ]);

  const displayPath = combinePath(
    `${prettifyRoot(root)}${selectedFolder}`,
    fileName,
    extension
  );

  const isCreating = status === "PENDING";

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
            <Grid item xs={6}>
              <TextField
                {...register("fileName")}
                label="File name"
                disabled={isCreating}
                autoFocus
                fullWidth
                data-test-id="file-manager-file-name-textfield"
              />
            </Grid>

            <Grid item xs={6}>
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
                  disabled={isCreating}
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
            <Grid item xs={12}>
              <InputLabel>
                <Checkbox {...register("createStep")} checked={createStep} />
                Create a new step for this file
              </InputLabel>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<CloseIcon />}
            color="secondary"
            onClick={onClose}
            tabIndex={-1}
          >
            Cancel
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            type="submit"
            form="create-file"
            disabled={isCreating}
            data-test-id="file-manager-create-file"
          >
            Create file
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
