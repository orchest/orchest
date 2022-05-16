import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
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
  fetcher,
  FetchError,
} from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot } from "../common";
import {
  allowedExtensionsMarkup,
  FILE_MANAGEMENT_ENDPOINT,
  lastSelectedFolderPath,
  queryArgs,
  ROOT_SEPARATOR,
} from "./common";
import { useFileManagerContext } from "./FileManagerContext";

export const CreateFileDialog = ({
  isOpen,
  root = "/project-dir",
  onClose,
  onSuccess,
  projectUuid,
  initialFileName,
}: {
  isOpen: boolean;
  root?: FileManagementRoot;
  onClose: () => void;
  onSuccess: (filePath: string) => void;
  projectUuid: string | undefined;
  initialFileName?: string;
}) => {
  // Global state
  const { setAlert } = useAppContext();
  const { selectedFiles } = useFileManagerContext();

  const lastSelectedFolder = React.useMemo(() => {
    return lastSelectedFolderPath(selectedFiles);
  }, [selectedFiles]);

  // local states

  // we don't want to apply toValidFilename here
  // because user needs to use relative path as part of file name change the final path
  // ? allow user to change file path, so user is not forced to abuse "file name"?
  const [fileName, setFileName] = React.useState(() => "");
  const [fileExtension, setFileExtension] = React.useState(
    `.${ALLOWED_STEP_EXTENSIONS[0]}`
  );

  const rootFolderForDisplay = root === "/project-dir" ? "Project files" : root;
  const fullFilePathForDisplay = `${rootFolderForDisplay}${lastSelectedFolder}${fileName}${fileExtension}`;

  const { run, setError, error, status: createFileStatus } = useAsync<
    void,
    FetchError
  >();
  const isCreating = createFileStatus === "PENDING";
  const onSubmitModal = async () => {
    if (isCreating || !projectUuid) return;

    const fullFilePath = `${lastSelectedFolder}${fileName}${fileExtension}`;

    await run(
      fetcher(
        `${FILE_MANAGEMENT_ENDPOINT}/create?${queryArgs({
          project_uuid: projectUuid,
          root,
          path: fullFilePath,
        })}`,
        { method: "POST" }
      ).then(() => {
        const finalFilePath = `${root}${ROOT_SEPARATOR}${fullFilePath}`;
        onSuccess(finalFilePath);
      })
    );
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      setFileName(
        initialFileName
          ? initialFileName.split("/").slice(-1).join("/").split(".")[0]
          : ""
      );
    }
  }, [isOpen, initialFileName]);

  React.useEffect(() => {
    if (error) {
      setAlert(
        "Error",
        `Unable to create file. ${error.message}`,
        (resolve) => {
          setError(null);
          resolve(true);
          return true;
        }
      );
    }
  }, [setAlert, setError, error]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      data-test-id="file-manager-create-new-file-dialog"
      maxWidth="sm"
      fullWidth
    >
      <form
        id="create-file"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSubmitModal();
        }}
      >
        <DialogTitle>Create a new file</DialogTitle>
        <DialogContent>
          <div className="create-file-input">
            <div className="push-down">
              Supported file extensions are:&nbsp;
              {allowedExtensionsMarkup}.
            </div>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="File name"
                  autoFocus
                  value={fileName}
                  fullWidth
                  disabled={isCreating}
                  onChange={(e) => setFileName(e.target.value)}
                  data-test-id="file-manager-file-name-textfield"
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel id="file-manager-file-extension-label">
                    Extension
                  </InputLabel>
                  <Select
                    label="Extension"
                    labelId="file-manager-file-extension-label"
                    id="file-manager-file-extension"
                    disabled={isCreating}
                    value={fileExtension}
                    onChange={(e) => setFileExtension(e.target.value)}
                  >
                    {ALLOWED_STEP_EXTENSIONS.map((el) => {
                      const value = `.${el}`;
                      return (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="File path"
                  value={fullFilePathForDisplay}
                  fullWidth
                  margin="normal"
                  disabled
                />
              </Grid>
            </Grid>
          </div>
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
