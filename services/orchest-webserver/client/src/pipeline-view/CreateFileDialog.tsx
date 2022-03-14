import { Code } from "@/components/common/Code";
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
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import {
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  fetcher,
  FetchError,
  HEADER,
} from "@orchest/lib-utils";
import React from "react";

const allowedExtensionsMarkup = ALLOWED_STEP_EXTENSIONS.map((el, index) => {
  return (
    <span key={el}>
      <Code>.{el}</Code>
      {index < ALLOWED_STEP_EXTENSIONS.length - 1 ? <>&nbsp;, </> : ""}
    </span>
  );
});

export const CreateFileDialog = ({
  isOpen,
  folderPath,
  onClose,
  projectUuid,
  pipelineUuid,
  stepUuid,
  initialFileName,
}: {
  isOpen: boolean;
  folderPath: string;
  onClose: () => void;
  projectUuid: string;
  pipelineUuid: string;
  stepUuid: string;
  initialFileName?: string;
}) => {
  // Global state
  const { setAlert } = useAppContext();

  // local states

  // we don't want to apply toValidFilename here
  // because user needs to use relative path as part of file name change the final path
  // ? allow user to change file path, so user is not forced to abuse "file name"?
  const [fileName, setFileName] = React.useState(() => "");
  const [fileExtension, setFileExtension] = React.useState(
    `.${ALLOWED_STEP_EXTENSIONS[0]}`
  );

  const fullProjectPath = `${folderPath}${fileName}${fileExtension}`;

  const onChangeNewFilenameExtension = (value: string) =>
    setFileExtension(value);

  const { run, setError, error, status: createFileStatus } = useAsync<
    void,
    FetchError
  >();
  const isCreating = createFileStatus === "PENDING";
  const onSubmitModal = async () => {
    if (isCreating) return;
    // validate extensions
    let extension = extensionFromFilename(fullProjectPath);

    if (!ALLOWED_STEP_EXTENSIONS.includes(extension)) {
      setAlert(
        "Error",
        <div>
          <p>Invalid file extension</p>
          {`Extension ${extension} is not in allowed set of `}
          {allowedExtensionsMarkup}.
        </div>
      );
      return;
    }

    await run(
      fetcher(
        `/async/project-files/create/${projectUuid}/${pipelineUuid}/${stepUuid}`,
        {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({ file_path: fullProjectPath }),
        }
      )
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
      const message =
        error.status === 409
          ? "A file with this name already exists."
          : error.message;

      setAlert("Error", message, (resolve) => {
        setError(null);
        resolve(true);
        return true;
      });
    }
  }, [setAlert, setError, error]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      data-test-id="project-file-picker-create-new-file-dialog"
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
            <Stack direction="row" spacing={2}>
              <TextField
                label="File name"
                autoFocus
                value={fileName}
                fullWidth
                disabled={isCreating}
                onChange={(e) => setFileName(e.target.value)}
                data-test-id="project-file-picker-file-name-textfield"
              />
              <FormControl fullWidth>
                <InputLabel id="project-file-picker-file-extension-label">
                  Extension
                </InputLabel>
                <Select
                  label="Extension"
                  labelId="project-file-picker-file-extension-label"
                  id="project-file-picker-file-extension"
                  disabled={isCreating}
                  value={fileExtension}
                  onChange={(e) => onChangeNewFilenameExtension(e.target.value)}
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
            </Stack>
            <TextField
              label="Path in project"
              value={fullProjectPath}
              fullWidth
              margin="normal"
              disabled
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<CloseIcon />} color="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            type="submit"
            form="create-file"
            disabled={isCreating}
            data-test-id="project-file-picker-create-file"
          >
            Create file
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
