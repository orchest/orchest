import React from "react";

import {
  MDCButtonReact,
  MDCDialogReact,
  MDCLinearProgressReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import { useLocationQuery } from "@/hooks/useCustomRoute";

import type {
  BackgroundTask,
  CreateProjectError,
} from "@/utils/webserver-utils";

import { useImportProject } from "./hooks/useImportProject";

const PrefilledWarning = () => {
  return (
    <div className="push-down warning">
      <p>
        <i className="material-icons">warning</i> The import URL was pre-filled.
        Make sure you trust the <span className="code">git</span>
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
          <MDCLinearProgressReact />
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

const ImportDialog: React.FC<{
  projectName: string;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  initialImportUrl?: string;
  onImportComplete?: (backgroundTaskResult: BackgroundTask) => void;
  setShouldOpen: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({
  projectName,
  setProjectName,
  initialImportUrl,
  onImportComplete,
  setShouldOpen,
}) => {
  const [importUrlFromQuerystring] = useLocationQuery(["import_url"]);

  const hasPrefilledImportUrl =
    initialImportUrl ||
    (importUrlFromQuerystring && typeof importUrlFromQuerystring === "string");

  // if user loads the app with a pre-filled import_url in their query string
  // we prompt them directly with the import modal
  React.useEffect(() => {
    if (hasPrefilledImportUrl) setShouldOpen(true);
  }, []);

  const [importUrl, setImportUrl] = React.useState<string>(
    hasPrefilledImportUrl
      ? initialImportUrl ||
          window.decodeURIComponent(importUrlFromQuerystring as string)
      : ""
  );

  const { startImport, importResult } = useImportProject(
    projectName,
    importUrl,
    (result) => {
      if (result.status === "SUCCESS") {
        setImportUrl("");
        setProjectName("");
        if (onImportComplete) onImportComplete(result);

        // unmount this dialog as the last state update
        setShouldOpen(false);
      }
    }
  );

  const onClose = () => setShouldOpen(false);

  // if the URL is not from Orchest, we warn the user
  const shouldShowWarning =
    hasPrefilledImportUrl &&
    !/^https:\/\/github.com\/orchest\//.test(importUrl.toLowerCase());

  return (
    <MDCDialogReact
      title="Import a project"
      onClose={onClose}
      content={
        <div
          className="project-import-modal"
          data-test-id="import-project-dialog"
        >
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
      }
      actions={
        <>
          <MDCButtonReact
            icon="close"
            label="Close"
            classNames={["push-right"]}
            onClick={onClose}
          />
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
            onClick={startImport}
            data-test-id="import-project-ok"
          />
        </>
      }
    />
  );
};

export { ImportDialog };
