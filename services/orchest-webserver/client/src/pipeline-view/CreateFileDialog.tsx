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
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
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

const KernelLanguage = {
  python: "Python",
  julia: "Julia",
  r: "R",
};

export const CreateFileDialog = ({
  isOpen,
  folderPath = "",
  onClose,
  onSuccess,
  projectUuid,
  initialFileName,
}: {
  isOpen: boolean;
  folderPath?: string;
  onClose: () => void;
  onSuccess: () => void;
  projectUuid: string;
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

  const [kernelLanguage, setKernelLanguage] = React.useState<
    keyof typeof KernelLanguage
  >("python");

  const fullProjectPath = `${folderPath}${fileName}${fileExtension}`;

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
      fetcher(`/async/project-files/create/${projectUuid}`, {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({
          file_path: fullProjectPath,
          kernel_name: kernelLanguage,
        }),
      })
    );
    onSuccess();
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
      maxWidth="md"
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
                  data-test-id="project-file-picker-file-name-textfield"
                />
              </Grid>
              <Grid item xs={fileExtension === ".ipynb" ? 3 : 6}>
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

              {fileExtension === ".ipynb" && (
                <Grid item xs={3}>
                  <FormControl fullWidth>
                    <InputLabel id="project-file-kernel-language-label">
                      Kernel language
                    </InputLabel>
                    <Select
                      label="Kernel language"
                      labelId="project-file-kernel-language-label"
                      id="project-file-kernel-language"
                      disabled={isCreating}
                      value={kernelLanguage}
                      onChange={(e) =>
                        setKernelLanguage(
                          e.target.value as keyof typeof KernelLanguage
                        )
                      }
                    >
                      {Object.entries(KernelLanguage).map(([value, label]) => {
                        return (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  label="Path in project"
                  value={fullProjectPath}
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
            data-test-id="project-file-picker-create-file"
          >
            Create file
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
