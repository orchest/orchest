import { useOrchest } from "@/hooks/orchest";
import { Project } from "@/types";
import { BackgroundTask, CreateProjectError } from "@/utils/webserver-utils";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import { MDCButtonReact, MDCTextFieldReact } from "@orchest/lib-mdc";
import { makeRequest } from "@orchest/lib-utils";
import React from "react";
import { useImportProject } from "./hooks/useImportProject";

const PrefilledWarning = () => {
  return (
    <div className="push-down warning">
      <p>
        <i className="material-icons">warning</i> The import URL was not from
        Orchest. Make sure you trust the <span className="code">git</span>
        {" repository you're importing."}
      </p>
    </div>
  );
};

const ERROR_MAPPING: Record<CreateProjectError, string> = {
  "project move failed": "failed to move project because the directory exists.",
  "project name contains illegal character":
    "project name contains illegal character(s).",
} as const;

const getMappedErrorMessage = (key: CreateProjectError | string) => {
  if (ERROR_MAPPING[key] !== undefined) {
    return ERROR_MAPPING[key];
  } else {
    return "undefined error. Please try again.";
  }
};

const ImportStatusNotification = ({ data }: { data?: BackgroundTask }) => {
  return data ? (
    <>
      {data.status === "PENDING" && (
        <div className="push-up">
          <LinearProgress />
        </div>
      )}
      {data.status === "FAILURE" && (
        <div className="push-up">
          <p>
            <i className="material-icons float-left">error</i> Import failed:{" "}
            {getMappedErrorMessage(data.result)}
          </p>
        </div>
      )}
    </>
  ) : null;
};

const getProjectNameFromUrl = (importUrl: string) => {
  const matchGithubRepoName = importUrl.match(/\/([^\/]+)$/);
  return matchGithubRepoName ? matchGithubRepoName[1] : "";
};

const ImportDialog: React.FC<{
  projectName: string;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  importUrl?: string;
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
  const { dispatch } = useOrchest();

  const [isCloseVisible, setIsCloseVisible] = React.useState(true);

  const { startImport: fireImportRequest, importResult } = useImportProject(
    projectName,
    importUrl,
    async (result) => {
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
            type: "projectsSet",
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
      setIsCloseVisible(true);
    }
  }, [importResult]);

  const startImport = () => {
    setIsCloseVisible(false);
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
    <Dialog open={open}>
      <DialogTitle>Import a project</DialogTitle>
      <DialogContent>
        <div data-test-id="import-project-dialog">
          {shouldShowWarning && <PrefilledWarning />}
          <p className="push-down">
            Import a <span className="code">git</span> repository by specifying
            the <span className="code">HTTPS</span> URL below:
          </p>
          <MDCTextFieldReact
            classNames={["fullwidth push-down"]}
            label="Git repository URL"
            value={importUrl}
            onChange={setImportUrl}
            data-test-id="project-url-textfield"
          />
          <MDCTextFieldReact
            classNames={["fullwidth"]}
            label="Project name (optional)"
            value={projectName}
            onChange={setProjectName}
            data-test-id="project-name-textfield"
          />

          {importResult && <ImportStatusNotification data={importResult} />}

          <p className="push-up">
            To import <b>private </b>
            <span className="code">git</span> repositories upload them directly
            through the File Manager into the{" "}
            <span className="code">projects/</span> directory.
          </p>
        </div>
      </DialogContent>
      <DialogActions>
        {isCloseVisible && (
          <MDCButtonReact
            icon="close"
            label="Close"
            classNames={["push-right"]}
            onClick={closeDialog}
          />
        )}
        <MDCButtonReact
          icon="input"
          // So that the button is disabled when in a states
          // that requires so (currently ["PENDING"]).
          disabled={["PENDING"].includes(
            importResult !== null ? importResult.status : undefined
          )}
          classNames={["mdc-button--raised", "themed-secondary"]}
          label="Import"
          submitButton
          onClick={() => {
            startImport();
          }}
          data-test-id="import-project-ok"
        />
      </DialogActions>
    </Dialog>
  );
};

export { ImportDialog };
