import { useAppContext } from "@/contexts/AppContext";
import { useAsync } from "@/hooks/useAsync";
import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { FileTree } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import WarningIcon from "@mui/icons-material/Warning";
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
  absoluteToRelativePath,
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  fetcher,
  FetchError,
  HEADER,
} from "@orchest/lib-utils";
import React from "react";
import { Code } from "./common/Code";
import FilePicker from "./FilePicker";

type DirectoryDetails = {
  tree: FileTree;
  cwd: string;
};

const useFileDirectoryDetails = (
  project_uuid: string,
  pipeline_uuid: string
) => {
  const { setAlert } = useAppContext();

  const { data: directoryDetails, run, error } = useAsync<DirectoryDetails>();
  const { tree, cwd } = directoryDetails || {};

  React.useEffect(() => {
    if (error) {
      setAlert("Error", `Failed to fetch file directory details: ${error}`);
    }
  }, [setAlert, error]);

  const fetchDirectoryDetails = React.useCallback(() => {
    if (project_uuid && pipeline_uuid) {
      run(
        Promise.all([
          fetcher<FileTree>(`/async/file-picker-tree/${project_uuid}`),
          fetcher<{ cwd: string }>(
            `/async/file-picker-tree/pipeline-cwd/${project_uuid}/${pipeline_uuid}`
          ).then((response) => `${response["cwd"]}/`), // FilePicker cwd expects trailing / for cwd paths
        ]).then(([tree, cwd]) => {
          return { tree, cwd };
        })
      );
    }
  }, [project_uuid, pipeline_uuid, run]);

  React.useEffect(() => {
    fetchDirectoryDetails();
  }, [fetchDirectoryDetails]);

  return { tree, cwd, fetchDirectoryDetails };
};

const ProjectFilePicker: React.FC<{
  project_uuid: string;
  pipeline_uuid: string;
  step_uuid: string;
  value: string;
  onChange: (value: string) => void;
  menuMaxWidth?: string;
}> = ({
  onChange,
  project_uuid,
  pipeline_uuid,
  step_uuid,
  value,
  menuMaxWidth,
}) => {
  // global state
  const { setAlert } = useAppContext();

  // fetching data
  const { tree, cwd, fetchDirectoryDetails } = useFileDirectoryDetails(
    project_uuid,
    pipeline_uuid
  );

  const selectedFileExists = useCheckFileValidity(
    project_uuid,
    pipeline_uuid,
    value
  );

  // local states
  const [createFileModal, setCreateFileModal] = React.useState(false);
  // we don't want to apply toValidFilename here
  // because user needs to use relative path as part of file name change the final path
  // ? allow user to change file path, so user is not forced to abuse "file name"?
  const [fileName, setFileName] = React.useState("");
  const [createFileDir, setCreateFileDir] = React.useState("");
  const [fileExtension, setFileExtension] = React.useState(
    `.${ALLOWED_STEP_EXTENSIONS[0]}`
  );

  const onChangeFileValue = (value: string) => onChange(value);

  const onCreateFile = (dir: string) => {
    let fileNameProposal = value
      ? value.split("/").slice(-1).join("/").split(".")[0]
      : "";

    setCreateFileModal(true);
    setFileName(fileNameProposal);
    setCreateFileDir(dir);
  };

  const fullProjectPath = `${createFileDir}${fileName}${fileExtension}`;

  const onCloseCreateFileModal = () => setCreateFileModal(false);

  const onChangeNewFilenameExtension = (value: string) =>
    setFileExtension(value);

  const { run, error, status: createFileStatus } = useAsync<void, FetchError>();
  const createNewFile = () => {
    run(
      fetcher(
        `/async/project-files/create/${project_uuid}/${pipeline_uuid}/${step_uuid}`,
        {
          method: "POST",
          headers: HEADER.JSON,
          body: JSON.stringify({
            file_path: fullProjectPath,
          }),
        }
      ).then(() => {
        onChangeFileValue(
          absoluteToRelativePath(fullProjectPath, cwd).slice(1)
        );

        setCreateFileModal(false);

        // fetch file tree again with new file in it
        fetchDirectoryDetails();
      })
    );
  };
  const isCreating = createFileStatus === "PENDING";

  React.useEffect(() => {
    if (error && error.status === 409)
      setAlert("Error", "A file with this name already exists.");
  }, [error, setAlert]);

  const onSubmitModal = () => {
    // validate extensions
    let extension = extensionFromFilename(fullProjectPath);

    // TODO: case insensitive extension checking?
    if (!ALLOWED_STEP_EXTENSIONS.includes(extension)) {
      setAlert(
        "Error",
        <div>
          <p>Invalid file extension</p>
          {`Extension ${extension} is not in allowed set of `}
          {allowedExtensionsMarkup()}.
        </div>
      );

      return;
    }

    createNewFile();
  };

  const allowedExtensionsMarkup = () => {
    return ALLOWED_STEP_EXTENSIONS.map((el, index) => {
      return (
        <span key={el}>
          <Code>.{el}</Code>
          {index < ALLOWED_STEP_EXTENSIONS.length - 1 ? (
            <React.Fragment>&nbsp;, </React.Fragment>
          ) : (
            ""
          )}
        </span>
      );
    });
  };

  const onFocus = () => fetchDirectoryDetails();

  return (
    <>
      <Dialog
        open={createFileModal}
        onClose={onCloseCreateFileModal}
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
                {allowedExtensionsMarkup()}.
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
                    onChange={(e) =>
                      onChangeNewFilenameExtension(e.target.value)
                    }
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
            <Button
              startIcon={<CloseIcon />}
              color="secondary"
              onClick={onCloseCreateFileModal}
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
      {cwd && tree && (
        <FilePicker
          tree={tree}
          cwd={cwd}
          onFocus={onFocus}
          value={value}
          icon={
            selectedFileExists ? (
              <CheckIcon color="success" />
            ) : (
              <WarningIcon color="warning" />
            )
          }
          helperText={
            selectedFileExists
              ? "File exists in the project directory."
              : "Warning: this file wasn't found in the project directory."
          }
          onCreateFile={onCreateFile}
          onChangeValue={onChangeFileValue}
          menuMaxWidth={menuMaxWidth}
        />
      )}
    </>
  );
};

export default ProjectFilePicker;
