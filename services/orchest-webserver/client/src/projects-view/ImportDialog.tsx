import { Code } from "@/components/common/Code";
import { DropZone } from "@/components/DropZone";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { Project } from "@/types";
import { BackgroundTask, CreateProjectError } from "@/utils/webserver-utils";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import WarningIcon from "@mui/icons-material/Warning";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetcher, validURL } from "@orchest/lib-utils";
import React from "react";
import { useImportGitRepo, validProjectName } from "./hooks/useImportGitRepo";

const ERROR_MAPPING: Record<CreateProjectError, string> = {
  "project move failed": "failed to move project because the directory exists.",
  "project name contains illegal character":
    "project name contains illegal character(s).",
} as const;

const getMappedErrorMessage = (key: CreateProjectError | string | null) => {
  if (key && ERROR_MAPPING[key] !== undefined) {
    return ERROR_MAPPING[key];
  } else {
    return "Unknown error. Please try again.";
  }
};

const getProjectNameFromUrl = (importUrl: string) => {
  const matchGithubRepoName = importUrl.match(/\/([^\/]+)\/?$/);
  return matchGithubRepoName ? matchGithubRepoName[1] : "";
};

const HelperText: React.FC = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    }}
  >
    <WarningIcon
      sx={{
        marginRight: (theme) => theme.spacing(1),
        fontSize: (theme) => theme.typography.subtitle2.fontSize,
      }}
    />
    {children}
  </Typography>
);

const validateImportUrl = (
  shouldValidate: boolean,
  importUrl: string
): { error: boolean; helperText: React.ReactNode } => {
  if (!shouldValidate) return { error: false, helperText: " " };
  if (importUrl.length === 0) return { error: false, helperText: " " };

  // if the URL is not from Orchest, we warn the user
  const isOrchestExample = /^https:\/\/github.com\/orchest(\-examples)?\//.test(
    importUrl
  );

  if (!validURL(importUrl))
    return {
      error: true,
      helperText: (
        <HelperText>
          Please make sure you enter a valid HTTPS git-repo URL.
        </HelperText>
      ),
    };

  if (!isOrchestExample)
    return {
      error: false,
      helperText: (
        <HelperText>
          The import URL was not from Orchest. Make sure you trust this git
          repository.
        </HelperText>
      ),
    };

  return { error: false, helperText: " " };
};

const ImportDialog: React.FC<{
  projectName: string;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  importUrl: string;
  setImportUrl: (url: string) => void;
  onImportComplete?: (backgroundTaskResult: BackgroundTask) => void;
  open: boolean;
  onClose: () => void;
}> = ({
  projectName,
  setProjectName,
  importUrl,
  setImportUrl,
  onImportComplete,
  open,
  onClose,
}) => {
  const { dispatch } = useProjectsContext();

  const [isAllowedToClose, setIsAllowedToClose] = React.useState(true);

  const [shouldValidateImportUrl, setShouldValidateImportUrl] = React.useState(
    false
  );

  const [
    shouldValidateProjectName,
    setShouldValidateProjectName,
  ] = React.useState(false);

  const {
    startImport: fireImportRequest,
    importResult,
    clearImportResult,
  } = useImportGitRepo(projectName, importUrl, async (result) => {
    if (!result) {
      // failed to import
      setIsAllowedToClose(true);
      return;
    }
    if (result.status === "SUCCESS") {
      setImportUrl("");
      setProjectName("");
      onClose();

      if (onImportComplete) {
        // result.result is project.path (projectName), but project_uuid is not yet available,
        // because it requires a file-discovery request to instantiate `project_uuid`.
        // Therefore, it requires another GET call to get it's uuid
        const projects = await fetcher<Project[]>("/async/projects");

        dispatch({ type: "SET_PROJECTS", payload: projects });

        const finalProjectName =
          projectName || getProjectNameFromUrl(importUrl);

        setProjectName(finalProjectName);

        const foundByName = projects.find(
          (project) => project.path === finalProjectName
        ) as Project;

        // use result as the payload to pass along projectUuid
        onImportComplete({ ...result, result: foundByName.uuid });
      }
    }
  });

  const [status, setStatus] = React.useState<
    "READY" | "IMPORTING" | "IMPORTED"
  >("READY");

  React.useEffect(() => {
    if (status === "IMPORTED") setIsAllowedToClose(true);
  }, [status]);

  const startImport = () => {
    setIsAllowedToClose(false);
    setStatus("IMPORTING");
    fireImportRequest();
  };

  const closeDialog = () => {
    setImportUrl("");
    setProjectName("");
    setStatus("READY");
    onClose();
  };

  const importUrlValidation = React.useMemo(
    () =>
      validateImportUrl(!importResult && shouldValidateImportUrl, importUrl),
    [importUrl, shouldValidateImportUrl, importResult]
  );

  const projectNameValidation = React.useMemo(() => {
    if (!shouldValidateProjectName) return { error: false, helperText: " " };
    const validation = validProjectName(projectName);
    if (validation.valid)
      return {
        error: false,
        helperText: "",
      };
    return {
      error: !validation.valid,
      helperText: validation.reason,
    };
  }, [shouldValidateProjectName, projectName]);

  return (
    <Dialog
      open={open}
      onClose={isAllowedToClose ? closeDialog : undefined}
      fullWidth
      maxWidth="sm"
    >
      <form
        id="import-project"
        onSubmit={(e) => {
          e.preventDefault();
          startImport();
        }}
      >
        <DialogTitle>Import project</DialogTitle>
        <DialogContent>
          <Stack direction="column" spacing={2}>
            <Stack
              direction="column"
              data-test-id="import-project-dialog"
              spacing={1}
            >
              <Typography>
                Paste <Code>HTTPS</Code> link to <Code>git</Code> repository:
              </Typography>
              <TextField
                fullWidth
                autoFocus
                placeholder="Git repository URL"
                onBlur={() => setShouldValidateImportUrl(true)}
                {...importUrlValidation}
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                data-test-id="project-url-textfield"
              />
              {importResult?.status === "FAILURE" && (
                <Alert
                  severity="error"
                  sx={{ marginTop: (theme) => theme.spacing(1) }}
                  onClose={clearImportResult}
                >
                  Import failed: {getMappedErrorMessage(importResult.result)}
                </Alert>
              )}
            </Stack>
            <Stack direction="column" spacing={1}>
              <Typography>Or upload from computer:</Typography>
              <DropZone disableOverlay uploadFiles={() => Promise.resolve()}>
                {(isDragActive: boolean) => (
                  <Stack
                    justifyContent="center"
                    alignItems="center"
                    direction="column"
                    spacing={1}
                    sx={{
                      height: "16vh",
                      border: (theme) =>
                        `2px dashed ${
                          isDragActive
                            ? theme.palette.primary.main
                            : theme.palette.grey[400]
                        }`,
                      borderRadius: (theme) => theme.spacing(0.5),
                      backgroundColor: (theme) =>
                        isDragActive
                          ? alpha(theme.palette.primary.main, 0.08)
                          : theme.palette.common.white,
                    }}
                  >
                    <DriveFolderUploadOutlinedIcon
                      fontSize="large"
                      sx={{
                        color: (theme) =>
                          isDragActive
                            ? theme.palette.primary.main
                            : theme.palette.grey[500],
                      }}
                    />
                    <Typography variant="body2">{`Drag & drop project folder here`}</Typography>
                    <Button>Browse files</Button>
                  </Stack>
                )}
              </DropZone>
            </Stack>
            {false && (
              <Stack>
                <TextField
                  fullWidth
                  label="Project name"
                  value={projectName}
                  onChange={(e) => {
                    if (!shouldValidateProjectName)
                      setShouldValidateProjectName(true);
                    setProjectName(e.target.value.replace(/[^\w\.]/g, "-"));
                  }}
                  {...projectNameValidation}
                  data-test-id="project-name-textfield"
                />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="secondary"
            onClick={closeDialog}
            disabled={!isAllowedToClose}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            // So that the button is disabled when in a states
            // that requires so (currently ["PENDING"]).
            disabled={
              importUrlValidation.error || importResult?.status === "PENDING"
            }
            type="submit"
            form="import-project"
            data-test-id="import-project-ok"
          >
            Import
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export { ImportDialog };
