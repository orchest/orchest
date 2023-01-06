import { projectsApi } from "@/api/projects/projectsApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { ErrorSummary } from "@/components/common/ErrorSummary";
import { DropZone } from "@/components/DropZone";
import { UploadFilesForm } from "@/components/UploadFilesForm";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCancelableFetch } from "@/hooks/useCancelablePromise";
import { useControlledIsOpen } from "@/hooks/useControlledIsOpen";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { fetchProject } from "@/hooks/useFetchProject";
import { useFetchProjects } from "@/hooks/useFetchProjects";
import {
  FileWithValidPath,
  isUploadedViaDropzone,
  useUploader,
} from "@/hooks/useUploader";
import { FILE_MANAGEMENT_ENDPOINT } from "@/pipeline-view/file-manager/common";
import { siteMap } from "@/routingConfig";
import { GitImportError, Project } from "@/types";
import { queryArgs } from "@/utils/text";
import { isNumber, withPlural } from "@/utils/webserver-utils";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import WarningIcon from "@mui/icons-material/Warning";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { alpha, SxProps, Theme } from "@mui/material/styles";
import useTheme from "@mui/material/styles/useTheme";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  fetcher,
  hasValue,
  HEADER,
  uuidv4,
  validGitRepo,
  validURL,
} from "@orchest/lib-utils";
import React from "react";
import { useGitImport, validProjectName } from "./hooks/useGitImport";

const ERROR_MAPPING: Partial<Record<GitImportError, string>> = {
  ProjectWithSameNameExists:
    "Failed to move project because the directory already exists.",
  NoAccessRightsOrRepoDoesNotExists:
    "SSH key is required or the repository doesn't exist",
} as const;

const getMappedErrorMessage = (key: GitImportError | undefined) => {
  if (key && ERROR_MAPPING[key] !== undefined) {
    return ERROR_MAPPING[key];
  } else {
    return "Failed to clone repo. Please try again.";
  }
};

const getProjectNameFromUrl = (importUrl: string) => {
  const matchGithubRepoName = importUrl.match(/\/([^\/]+)\/?$/);
  return matchGithubRepoName
    ? matchGithubRepoName[1].replace(/\.git$/, "")
    : "";
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
  importUrl: string
): { error: boolean; helperText: React.ReactNode } => {
  if (!validURL(importUrl) && !validGitRepo(importUrl))
    return {
      error: true,
      helperText: <HelperText>Not a valid git repository URL</HelperText>,
    };

  // if the URL is not from Orchest, warn the user about it.
  const isOrchestExample =
    /^https:\/\/github.com\/orchest(\-examples)?\//.test(importUrl) ||
    importUrl.startsWith("git@github.com:orchest/");

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

const TextWithPlaceHolder = ({
  value,
  unit,
}: {
  value: number | undefined;
  unit: string;
}) => {
  return isNumber(value) ? (
    <Typography variant="body2" sx={{ marginTop: (theme) => theme.spacing(1) }}>
      {withPlural(value, unit)}
    </Typography>
  ) : (
    <Skeleton
      width={100} // This is a magic number
      height={20}
      sx={{ marginTop: (theme) => theme.spacing(1) }}
    />
  );
};

const projectMetadataIconProps: SxProps<Theme> = {
  fontSize: "medium",
  color: (theme) => alpha(theme.palette.common.black, 0.46),
};

const ProjectMetadata = ({
  value,
}: {
  value: (Project & { fileCount: number }) | undefined;
}) => {
  const { fileCount, pipeline_count, environment_count } = value || {};
  return (
    <Stack direction="row" justifyContent="space-around" alignItems="center">
      <Stack direction="column" alignItems="center">
        <InsertDriveFileOutlinedIcon sx={projectMetadataIconProps} />
        <TextWithPlaceHolder value={fileCount} unit="File" />
      </Stack>
      <Stack direction="column" alignItems="center">
        <DeviceHubIcon sx={projectMetadataIconProps} />
        <TextWithPlaceHolder value={pipeline_count} unit="Pipeline" />
      </Stack>
      <Stack direction="column" alignItems="center">
        <ViewComfyIcon sx={projectMetadataIconProps} />
        <TextWithPlaceHolder value={environment_count} unit="Environment" />
      </Stack>
    </Stack>
  );
};

type DisplayStatus =
  | "READY"
  | "IMPORTING"
  | "UPLOADING"
  | "FILES_STORED"
  | "SAVING_PROJECT_NAME";

const dialogTitleMappings: Record<DisplayStatus, string> = {
  READY: "Import project",
  IMPORTING: "Importing project",
  UPLOADING: "Uploading project",
  FILES_STORED: "Import complete",
  SAVING_PROJECT_NAME: "Import complete",
};

type ImportDialogProps = {
  open?: boolean;
  onClose?: () => void;
  importWhenOpen?: boolean;
  importUrl: string;
  setImportUrl: (url: string) => void;
  onImportComplete?: (newProject: Pick<Project, "path" | "uuid">) => void;
  hideUploadOption?: boolean;
  filesToUpload?: FileList | File[];
  confirmButtonLabel?: string;
  children?: (onOpen: () => void) => React.ReactNode;
};

export const ImportDialog = ({
  open: isOpenByParent,
  onClose: onCloseByParent,
  importWhenOpen,
  importUrl,
  setImportUrl,
  onImportComplete: onImportCompleteByParent,
  confirmButtonLabel = "Save",
  hideUploadOption,
  filesToUpload,
  children,
}: ImportDialogProps) => {
  const { setAlert } = useGlobalContext();
  const { navigateTo } = useCustomRoute();
  const { projects, refresh: reloadProjects } = useFetchProjects();
  const deleteProject = useProjectsApi((api) => api.delete);

  const { isOpen, onClose, onOpen } = useControlledIsOpen(
    isOpenByParent,
    onCloseByParent
  );

  // Because import will occur before user giving a name,
  // a temporary projectName (`project.path`) is needed to start with.
  // Once project is created (i.e. projectUuid is generated by BE),
  // use `projectUuid` to rename the project as user desires.
  // NOTE: every time the dialog is open, a new uuid should be generated.
  const [projectName, setProjectName] = React.useState<string>("");
  const [tempProjectName, setTempProjectName] = React.useState<string>();

  React.useEffect(() => {
    if (isOpen) setTempProjectName(`temp-project-${uuidv4()}`);
  }, [isOpen]);

  const [
    shouldShowImportUrlValidation,
    setShouldShowImportUrlValidation,
  ] = React.useState(false);

  const [status, setStatus] = React.useState<DisplayStatus>("READY");
  const [newProjectUuid, setNewProjectUuid] = React.useState<string>();
  const canCloseWithEscape = status === "READY";

  const { cancelableFetch, cancelAll } = useCancelableFetch();
  const { uploadFiles, reset: resetUploader, ...uploader } = useUploader({
    root: "/data",
    isProjectUpload: true,
    fetch: cancelableFetch,
  });

  const gitImport = useGitImport(importUrl);

  const reset = React.useCallback(() => {
    setShouldShowImportUrlValidation(false);
    setImportUrl("");
    setProjectName("");
    setStatus("READY");
    setNewProjectUuid(undefined);
    setTempProjectName(undefined);
    resetUploader();
    gitImport.reset();
  }, [setImportUrl, resetUploader, gitImport]);

  const deleteTempProject = React.useCallback(async () => {
    if (!newProjectUuid) return;

    try {
      await deleteProject(newProjectUuid);
    } catch (error) {
      console.error(
        `Failed to delete the temporary project with UUID ${newProjectUuid}. ${error}`
      );
    }
  }, [newProjectUuid, deleteProject]);

  const closeDialog = React.useCallback(async () => {
    // if user forces closing the dialog, cancel all cancelable promises,
    // e.g. ongoing uploading file POST requests.
    cancelAll();
    deleteTempProject(); // No need to await this call; no point to block user for this.
    reset();
    onClose();
  }, [cancelAll, deleteTempProject, onClose, reset]);

  React.useEffect(() => {
    const importStatus = gitImport.status;
    if (!hasValue(importStatus)) return;
    if (gitImport.status === "FAILURE" || gitImport.status === "ABORTED") {
      setStatus("READY");
    }
  }, [gitImport.status]);

  const hasImported = gitImport.status === "SUCCESS";
  React.useEffect(() => {
    const { projectUuid } = gitImport;
    if (!hasImported || !projectUuid) return;

    setStatus("FILES_STORED");

    // Since we don't want to update the UI, we call the Projects API
    // directly, instead of `reloadProjects`
    projectsApi
      .fetchOne(projectUuid)
      .then((importedProject) => {
        if (importedProject) {
          setNewProjectUuid(importedProject?.uuid);
        }
      })
      .catch((error) => {
        closeDialog().then(() => {
          setAlert("Import failed", <ErrorSummary error={error} />);
        });

        // This will update the UI as well:
        reloadProjects();
      });
  }, [closeDialog, gitImport, hasImported, reloadProjects, setAlert]);

  const startImportGitRepo = React.useCallback(() => {
    setStatus("IMPORTING");
    const gitProjectName = getProjectNameFromUrl(importUrl);
    setProjectName(gitProjectName);

    const tempName = `${gitProjectName}-${uuidv4()}`;
    setTempProjectName(tempName);

    gitImport.start(tempName);
  }, [gitImport, importUrl]);

  React.useEffect(() => {
    if (importWhenOpen && importUrl && status === "READY") {
      startImportGitRepo();
    }
  }, [importWhenOpen, importUrl, status, startImportGitRepo]);

  const importUrlValidation = React.useMemo(
    () => validateImportUrl(importUrl),
    [importUrl]
  );

  const projectPaths = React.useMemo(
    () => Object.values(projects).map((project) => project.path),
    [projects]
  );

  const projectNameValidation = React.useMemo(() => {
    // Before the dialog is fully closed,
    // the new name is already saved into BE, so it will prompt with "project name already exists" error.
    if (["SAVING_PROJECT_NAME", "READY"].includes(status))
      return { error: false, helperText: " " };

    if (projectPaths.includes(projectName)) {
      return {
        error: true,
        helperText: `A project with the name "${projectName}" already exists.`,
      };
    }
    const validation = validProjectName(projectName);
    return {
      error: !validation.valid,
      // Assign an empty space when !shouldShowProjectNameValidation
      // to prevent UI jumping because of the height of `helperText` of `TextField`.
      helperText: validation.valid ? " " : validation.reason,
    };
  }, [projectPaths, projectName, status]);

  const onImportComplete = (newProject: Pick<Project, "uuid" | "path">) => {
    if (onImportCompleteByParent) {
      reset();
      onImportCompleteByParent(newProject);
      return;
    }
    navigateTo(siteMap.pipeline.path, {
      query: { projectUuid: newProject.uuid },
    });
  };

  const saveProjectName = async () => {
    if (!newProjectUuid || projectNameValidation.error) return;
    setStatus("SAVING_PROJECT_NAME");
    try {
      await projectsApi.put(newProjectUuid, { name: projectName });
      await reloadProjects();
      onImportComplete({ path: projectName, uuid: newProjectUuid });
      reset();
    } catch (error) {
      // Project is imported with a uuid (i.e. `tempProjectName`), but failed to rename.
      // Because we want user to give a meaningful name before closing,
      // user is not allowed to close the dialog before successfully submit and save projectName.
      // NOTE: user will get stuck here if changing project name cannot be done.
      setStatus("FILES_STORED");
    }
  };

  const [newProjectMetadata, setNewProjectMetadata] = React.useState<
    Project & { fileCount: number }
  >();

  const createProjectAndUploadFiles = React.useCallback(
    async (projectName: string, files: File[] | FileList) => {
      setStatus("UPLOADING");

      await uploadFiles(`/${projectName}/`, files);

      const { project_uuid } = await fetcher<{ project_uuid: string }>(
        `${FILE_MANAGEMENT_ENDPOINT}/import-project-from-data?${queryArgs({
          name: projectName,
        })}`,
        {
          method: "POST",
          headers: HEADER.JSON,
        }
      );

      // Get all the default info for this project.
      setNewProjectUuid(project_uuid);

      const tempProject = await fetchProject(project_uuid);

      if (tempProject) {
        setNewProjectMetadata({
          ...tempProject,
          pipeline_count: Array.from(files).reduce(
            (count, file: File | FileWithValidPath) => {
              const isPipelineFile = isUploadedViaDropzone(file)
                ? file.path.endsWith(".orchest")
                : file.webkitRelativePath.endsWith(".orchest");
              return isPipelineFile ? count + 1 : count;
            },
            0
          ),
          fileCount: files.length,
        });
      }
    },
    [uploadFiles]
  );

  const uploadFilesAndSetImportStatus = React.useCallback(
    async (files: FileList | File[]) => {
      if (!tempProjectName) {
        setAlert(
          "Error",
          "Failed to create a temporary project to start uploading."
        );
        reset();
        return;
      }

      try {
        setProjectName("");
        await createProjectAndUploadFiles(tempProjectName, files);
        setStatus("FILES_STORED");
        setTempProjectName(undefined);
      } catch (error) {
        setAlert("Error", "Failed to upload files.");
        reset();
      }
    },
    [
      createProjectAndUploadFiles,
      tempProjectName,
      setStatus,
      setProjectName,
      setAlert,
      reset,
    ]
  );

  // If `filesToUpload` is provided, it means that the parent component has gotten files already.
  // Immediately jump to `IMPORTING`.
  React.useEffect(() => {
    if (filesToUpload && tempProjectName && status === "READY") {
      uploadFilesAndSetImportStatus(filesToUpload);
    }
  }, [filesToUpload, tempProjectName, status, uploadFilesAndSetImportStatus]);

  const theme = useTheme();

  const [isHoverDropZone, setIsHoverDropZone] = React.useState(false);

  // While creating the temp project, cancel is not allowed.
  // the UUID of the temp project is needed for later operations in case user wants to cancel the whole process.
  const isShowingCancelButton = canCloseWithEscape;

  const title = React.useMemo(() => {
    const mappedTitle = dialogTitleMappings[status];
    return hideUploadOption
      ? mappedTitle.replace(/^Upload/, "Import")
      : mappedTitle;
  }, [status, hideUploadOption]);

  return (
    <>
      {hasValue(children) && children(onOpen)}
      <Dialog
        open={isOpen}
        onClose={canCloseWithEscape ? closeDialog : undefined}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack
            direction="column"
            spacing={2}
            data-test-id="import-project-dialog"
          >
            {status === "READY" && (
              <>
                <Stack direction="column" spacing={1}>
                  <Typography
                    variant="body1"
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    {"Paste URL of the git repository ("}
                    <Link
                      href="https://docs.orchest.io/en/stable/fundamentals/git_config_ssh_keys.html"
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      see docs
                    </Link>
                    {"):"}
                  </Typography>
                  <form
                    id="import-project"
                    onSubmit={(e) => {
                      e.preventDefault();
                      startImportGitRepo();
                    }}
                  >
                    <TextField
                      fullWidth
                      autoFocus={hideUploadOption}
                      placeholder="Git repository URL"
                      onBlur={() => {
                        if (importUrl.length > 0)
                          setShouldShowImportUrlValidation(true);
                      }}
                      {...(shouldShowImportUrlValidation
                        ? importUrlValidation
                        : {
                            // When showing the FAILURE alert, the space of helperText should be removed.
                            // In other cases, helperText should take space to prevent UI jumping.
                            helperText:
                              gitImport?.status === "FAILURE" ? "" : " ",
                          })}
                      value={importUrl}
                      onChange={(e) => {
                        if (e.target.value.length === 0)
                          setShouldShowImportUrlValidation(false);
                        setImportUrl(e.target.value);
                      }}
                      data-test-id="project-url-textfield"
                    />
                  </form>
                  {gitImport?.status === "FAILURE" && (
                    <Alert
                      severity="error"
                      sx={{ marginTop: (theme) => theme.spacing(1) }}
                    >
                      Import failed: {getMappedErrorMessage(gitImport.error)}
                    </Alert>
                  )}
                </Stack>
                {!hideUploadOption && (
                  <Stack direction="column" spacing={1}>
                    <Typography>Or upload from computer:</Typography>
                    <DropZone
                      disableOverlay
                      uploadFiles={uploadFilesAndSetImportStatus}
                    >
                      {(isDragActive) => (
                        <UploadFilesForm
                          folder
                          upload={uploadFilesAndSetImportStatus}
                        >
                          {(onClick) => (
                            <Stack
                              justifyContent="center"
                              alignItems="center"
                              direction="column"
                              onMouseOver={() => setIsHoverDropZone(true)}
                              onMouseLeave={() => setIsHoverDropZone(false)}
                              sx={{
                                height: "16vh",
                                border: (theme) =>
                                  `2px dashed ${theme.palette.grey[400]}`,
                                backgroundColor: (theme) =>
                                  theme.palette.common.white,
                                borderRadius: (theme) => theme.spacing(0.5),
                                cursor: "pointer",
                              }}
                              style={
                                isDragActive
                                  ? {
                                      border: `2px dashed ${theme.palette.primary.main}`,
                                      backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.08
                                      ),
                                    }
                                  : isHoverDropZone
                                  ? {
                                      border: `2px dashed ${theme.palette.grey[600]}`,
                                      backgroundColor: theme.palette.grey[50],
                                    }
                                  : {}
                              }
                              onClick={onClick}
                            >
                              <DriveFolderUploadOutlinedIcon
                                fontSize="large"
                                sx={{
                                  color: (theme) =>
                                    isDragActive
                                      ? theme.palette.primary.main
                                      : isHoverDropZone
                                      ? theme.palette.grey[600]
                                      : theme.palette.grey[500],
                                }}
                              />
                              <Typography variant="body2">{`Drag & drop project folder here`}</Typography>
                              <Button
                                sx={{ marginTop: (theme) => theme.spacing(1) }}
                              >
                                Browse files
                              </Button>
                            </Stack>
                          )}
                        </UploadFilesForm>
                      )}
                    </DropZone>
                  </Stack>
                )}
              </>
            )}
            {status !== "READY" && (
              <Stack direction="column" spacing={2}>
                {filesToUpload && (
                  <ProjectMetadata value={newProjectMetadata} />
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <LinearProgress
                    variant={
                      status === "IMPORTING" ? "indeterminate" : "determinate"
                    }
                    value={uploader.inProgress ? uploader.progress : 100}
                    sx={{ margin: (theme) => theme.spacing(1, 0), flex: 1 }}
                  />
                  <Typography variant="caption">
                    {uploader.inProgress
                      ? `${uploader.progress}%`
                      : status === "IMPORTING"
                      ? "Importing..."
                      : status === "FILES_STORED"
                      ? "Imported"
                      : undefined}
                  </Typography>
                </Stack>
                <form
                  id="save-project-name"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveProjectName();
                  }}
                >
                  <TextField
                    fullWidth
                    autoFocus
                    label="Project name"
                    value={projectName}
                    onChange={(e) => {
                      setProjectName(e.target.value.replace(/[^\w\.]/g, "-"));
                    }}
                    {...(projectName.length > 0
                      ? projectNameValidation
                      : { helperText: " " })}
                    disabled={status === "SAVING_PROJECT_NAME"}
                    data-test-id="import-dialog-name-input"
                  />
                </form>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          {isShowingCancelButton && (
            <Button
              onClick={closeDialog}
              tabIndex={-1}
              data-test-id="import-project-dialog-close-button"
            >
              {`Cancel${hideUploadOption ? "" : " upload"}`}
            </Button>
          )}
          {status === "READY" ? (
            <Button
              variant="contained"
              disabled={importUrlValidation.error}
              type="submit"
              form="import-project"
              data-test-id="import-project-dialog-next-button"
            >
              Import
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={
                !projectName ||
                projectNameValidation.error ||
                ["IMPORTING", "UPLOADING", "SAVING_PROJECT_NAME"].includes(
                  status
                )
              }
              type="submit"
              form="save-project-name"
              data-test-id="import-project-dialog-next-button"
            >
              {confirmButtonLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};
