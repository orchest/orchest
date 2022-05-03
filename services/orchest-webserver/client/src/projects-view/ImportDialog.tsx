import { BoldText } from "@/components/common/BoldText";
import { Code } from "@/components/common/Code";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { Project } from "@/types";
import { BackgroundTask, CreateProjectError } from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import InputIcon from "@mui/icons-material/Input";
import WarningIcon from "@mui/icons-material/Warning";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { makeRequest } from "@orchest/lib-utils";
import React from "react";
import { useImportProject } from "./hooks/useImportProject";

const ERROR_MAPPING: Record<CreateProjectError, string> = {
  "project move failed": "failed to move project because the directory exists.",
  "project name contains illegal character":
    "project name contains illegal character(s).",
} as const;

const getMappedErrorMessage = (key: CreateProjectError | string | null) => {
  if (key && ERROR_MAPPING[key] !== undefined) {
    return ERROR_MAPPING[key];
  } else {
    return "undefined error. Please try again.";
  }
};

const ImportStatusNotification = ({ data }: { data?: BackgroundTask }) => {
  return data ? (
    <>
      {data.status === "PENDING" && (
        <LinearProgress sx={{ margin: (theme) => theme.spacing(2, 0) }} />
      )}
      {data.status === "FAILURE" && (
        <Alert severity="error">
          Import failed: {getMappedErrorMessage(data.result)}
        </Alert>
      )}
    </>
  ) : null;
};

const getProjectNameFromUrl = (importUrl: string) => {
  const matchGithubRepoName = importUrl.match(/\/([^\/]+)\/?$/);
  return matchGithubRepoName ? matchGithubRepoName[1] : "";
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

  const { startImport: fireImportRequest, importResult } = useImportProject(
    projectName,
    importUrl,
    async (result) => {
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
          // currently result.result is project.path (projectName)
          // Ideally we'd like to have project_uuid, then we don't need to fetch the projects again.
          // TODO: change the BE so we can get project_uuid as result.result
          const response = await makeRequest("GET", "/async/projects");

          let projects: Project[] = JSON.parse(response);

          dispatch({
            type: "SET_PROJECTS",
            payload: projects,
          });

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
    }
  );
  React.useEffect(() => {
    if (importResult && importResult.status !== "PENDING") {
      setIsAllowedToClose(true);
    }
  }, [importResult]);

  const startImport = () => {
    setIsAllowedToClose(false);
    fireImportRequest();
  };

  const closeDialog = () => {
    setImportUrl("");
    setProjectName("");
    onClose();
  };

  // if the URL is not from Orchest, we warn the user
  const shouldShowWarning =
    importUrl !== "" &&
    !/^https:\/\/github.com\/orchest(\-examples)?\//.test(importUrl);

  return (
    <Dialog open={open} onClose={isAllowedToClose ? closeDialog : undefined}>
      <form
        id="import-project"
        onSubmit={(e) => {
          e.preventDefault();
          startImport();
        }}
      >
        <DialogTitle>Import a project</DialogTitle>
        <DialogContent>
          <Stack
            direction="column"
            spacing={2}
            data-test-id="import-project-dialog"
          >
            <Typography>
              Import a <Code>git</Code> repository by specifying the{" "}
              <Code>HTTPS</Code> URL below:
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Git repository URL"
              value={importUrl}
              helperText={
                !shouldShowWarning ? (
                  " "
                ) : (
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
                        fontSize: (theme) =>
                          theme.typography.subtitle2.fontSize,
                      }}
                    />
                    {`The import URL was not from Orchest. Make sure you trust this git repository.`}
                  </Typography>
                )
              }
              onChange={(e) => setImportUrl(e.target.value)}
              data-test-id="project-url-textfield"
            />
            <TextField
              fullWidth
              label="Project name (optional)"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value.replace(/[^\w\.]/g, "-"));
              }}
              data-test-id="project-name-textfield"
            />
            {importResult && <ImportStatusNotification data={importResult} />}
            <Alert severity="info">
              To import <BoldText>private</BoldText> git
              {` repositories upload them directly through the File Manager into the `}
              <Code dark sx={{ marginTop: (theme) => theme.spacing(1) }}>
                projects/
              </Code>
              {` directory.`}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          {isAllowedToClose && (
            <Button
              startIcon={<CloseIcon />}
              color="secondary"
              onClick={closeDialog}
            >
              Close
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<InputIcon />}
            // So that the button is disabled when in a states
            // that requires so (currently ["PENDING"]).
            disabled={importResult?.status === "PENDING"}
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
