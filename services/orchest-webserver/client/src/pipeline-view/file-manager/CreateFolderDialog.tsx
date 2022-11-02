import { useFileApi } from "@/api/files/useFileApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { FileRoot } from "@/utils/file";
import { ensureDirectory, join, truncateForDisplay } from "@/utils/path";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import React from "react";
import { prettifyRoot } from "./common";

type CreateFolderDialogProps = {
  isOpen: boolean;
  /** The folder to create the new folder in. */
  cwd: string;
  /** In which root to create the folder. */
  root: FileRoot;
  onClose: () => void;
  onSuccess?: (path: string) => void;
};

export const CreateFolderDialog = ({
  isOpen,
  root,
  onClose,
  onSuccess,
  cwd,
}: CreateFolderDialogProps) => {
  const createDirectory = useFileApi((api) => api.create);
  const { setAlert } = useGlobalContext();

  const [error, setError] = React.useState<unknown>();
  const [isCreating, setIsCreating] = React.useState(false);
  const [path, setPath] = React.useState(() => "");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreating(true);

    const newPath = ensureDirectory(join(cwd, path));

    createDirectory(root, newPath)
      .catch((reason) => setError(reason))
      .then(() => {
        setIsCreating(false);
        onClose();
        setPath("");
        onSuccess?.(newPath);
      });
  };

  React.useEffect(() => {
    if (isOpen) setPath("");
  }, [isOpen]);

  React.useEffect(() => {
    if (error) {
      setAlert(
        "Failed to create folder",
        <ErrorSummary error={error} />,
        () => {
          setError(undefined);
          return true;
        }
      );
    }
  }, [setAlert, setError, error]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      data-test-id="file-manager-create-new-folder-dialog"
      maxWidth="sm"
      fullWidth
    >
      <form id="create-folder" onSubmit={onSubmit}>
        <DialogTitle>New folder</DialogTitle>
        <DialogContent>
          <TextField
            label="Folder name"
            autoFocus
            value={path}
            fullWidth
            disabled={isCreating}
            onChange={(event) => setPath(event.target.value)}
            data-test-id="file-manager-file-name-textfield"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {truncateForDisplay(join(prettifyRoot(root), cwd))}
                </InputAdornment>
              ),
            }}
            sx={{ marginTop: (theme) => theme.spacing(2) }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} tabIndex={-1}>
            Cancel
          </Button>
          <Button
            variant="contained"
            type="submit"
            form="create-folder"
            disabled={isCreating}
            data-test-id="file-manager-create-folder"
          >
            Save folder
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
