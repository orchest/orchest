import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { fetchPipelines } from "@/hooks/useFetchPipelines";
import { siteMap } from "@/routingConfig";
import { IOrchestSessionUuid, PipelineMetaData } from "@/types";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useOpenNoteBook } from "../hooks/useOpenNoteBook";
import {
  baseNameFromPath,
  cleanFilePath,
  deduceRenameFromDragOperation,
  filePathFromHTMLElement,
  FileTrees,
  FILE_MANAGEMENT_ENDPOINT,
  FILE_MANAGER_ROOT_CLASS,
  filterRedundantChildPaths,
  findFilesByExtension,
  findPipelineFilePathsWithinFolders,
  generateTargetDescription,
  isFileByExtension,
  isWithinDataFolder,
  queryArgs,
  ROOT_SEPARATOR,
  unpackCombinedPath,
  UnpackedPath,
} from "./common";
import { DragIndicator } from "./DragIndicator";
import { useFileManagerContext } from "./FileManagerContext";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";
import { TreeItem } from "./TreeItem";
import { TreeRow } from "./TreeRow";

const isInFileManager = (element: HTMLElement) => {
  if (element.classList.contains(FILE_MANAGER_ROOT_CLASS)) return true;

  if (element.parentElement) {
    return isInFileManager(element.parentElement);
  }

  return false;
};

const findFileViaPath = (path: string, fileTrees: FileTrees) => {
  // example: /project-dir:/hello-world/folder/my-file.py
  const [root, filePathStr] = path.split(":");
  const filePath = filePathStr.split("/").filter((value) => value !== "");
  let head = fileTrees[root];

  for (let token of filePath) {
    const found = head.children.find((item) => item.name === token);
    if (!found) break;
    head = found;
  }
  return head;
};

const getFilePathChangeParams = (oldFilePath: string, newFilePath: string) => {
  const { root: oldRoot, path: oldPath } = unpackCombinedPath(oldFilePath);
  const { root: newRoot, path: newPath } = unpackCombinedPath(newFilePath);
  return { oldRoot, oldPath, newRoot, newPath };
};

const sendChangeFilePathRequest = ({
  oldPath,
  newPath,
  oldRoot,
  newRoot,
  projectUuid,
}: {
  oldPath: string;
  newPath: string;
  oldRoot: string;
  newRoot: string;
  projectUuid: string;
}) => {
  return fetcher(
    `${FILE_MANAGEMENT_ENDPOINT}/rename?${queryArgs({
      old_path: oldPath,
      new_path: newPath,
      old_root: oldRoot,
      new_root: newRoot,
      project_uuid: projectUuid,
    })}`,
    { method: "POST" }
  );
};

const sendChangePipelineFilePathRequest = (
  projectUuid: string,
  pipelineUuid: string,
  newPath: string
) => {
  return fetcher(`/async/pipelines/${projectUuid}/${pipelineUuid}`, {
    method: "PUT",
    headers: HEADER.JSON,
    body: JSON.stringify({ path: newPath.replace(/^\//, "") }), // The path should be relative to `/project-dir:/`.
  });
};

const doChangeFilePath = async ({
  pipelineUuid,
  projectUuid,
  ...params
}: {
  oldRoot: string;
  oldPath: string;
  newRoot: string;
  newPath: string;
  projectUuid: string;
  pipelineUuid?: string;
}) => {
  // sendChangePipelineFilePathRequest can only move a pipeline file within /project-dir:/ folder
  // to move .orchest file from /project-dir:/ to /data:/, use /async/file-management/rename endpoint, and delete the pipeline from state.pipelines.
  if (
    isFileByExtension(["orchest"], params.newPath) &&
    params.newRoot === "/project-dir" &&
    pipelineUuid
  ) {
    // `pipeline_uuid` is only needed when newRoot is  "/project-dir:/".
    if (!pipelineUuid) throw new Error("pipeline_uuid is required.");

    return sendChangePipelineFilePathRequest(
      projectUuid,
      pipelineUuid,
      params.newPath
    );
  }

  return sendChangeFilePathRequest({ ...params, projectUuid });
};

export const FileTree = React.memo(function FileTreeComponent({
  treeRoots,
  expanded,
  handleToggle,
  onRename,
}: {
  treeRoots: string[];
  expanded: string[];
  handleToggle: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  onRename: (oldPath: string, newPath: string) => void;
}) {
  const { setConfirm, setAlert } = useAppContext();
  const { projectUuid, pipelineUuid, navigateTo } = useCustomRoute();
  const { getSession, toggleSession } = useSessionsContext();
  const {
    state: { pipelines = [], pipeline },
    dispatch,
  } = useProjectsContext();

  const {
    selectedFiles,
    dragFile,
    setDragFile,
    hoveredPath,
    isDragging,
    fileTrees,
  } = useFileManagerContext();

  const { handleSelect, reload } = useFileManagerLocalContext();

  const openNotebook = useOpenNoteBook();

  const onOpen = React.useCallback(
    (filePath: string) => {
      if (isWithinDataFolder(filePath)) {
        setAlert(
          "Notice",
          <>
            This file cannot be opened from within <Code>/data</Code>. Please
            move it to <Code>Project files</Code>.
          </>
        );
        return;
      }

      const foundPipeline = isFileByExtension(["orchest"], filePath)
        ? pipelines.find(
            (pipeline) => pipeline.path === cleanFilePath(filePath)
          )
        : null;

      if (foundPipeline && foundPipeline.uuid !== pipelineUuid) {
        setConfirm(
          "Confirm",
          <>
            Are you sure you want to open pipeline <b>{foundPipeline.name}</b>?
          </>,
          {
            onConfirm: async (resolve) => {
              navigateTo(siteMap.pipeline.path, {
                query: { projectUuid, pipelineUuid: foundPipeline.uuid },
              });
              resolve(true);
              return true;
            },
            onCancel: async (resolve) => {
              resolve(false);
              return false;
            },
            confirmLabel: "Open pipeline",
            cancelLabel: "Cancel",
          }
        );
        return;
      }

      if (foundPipeline && foundPipeline.uuid === pipelineUuid) {
        setAlert("Notice", "This pipeline is already open.");
        return;
      }

      openNotebook(undefined, cleanFilePath(filePath));
    },
    [
      pipelines,
      projectUuid,
      pipelineUuid,
      setAlert,
      setConfirm,
      navigateTo,
      openNotebook,
    ]
  );

  const dragFiles = React.useMemo(() => {
    if (!dragFile) return [];
    if (!selectedFiles.includes(dragFile.path)) return [dragFile.path];

    // dragFiles cannot have nodes that are ancester/offspring of each other
    // because offspring nodes will be moved along with their ancesters.
    // e.g. given selection ["/a/", "/a/b.py"], "/a/b.py" should be removed
    return filterRedundantChildPaths(selectedFiles);
  }, [dragFile, selectedFiles]);

  const pipelineDics = React.useMemo(
    () =>
      pipelines.reduce((all, curr) => {
        return { ...all, [curr.path]: curr };
      }, {} as Record<string, PipelineMetaData>),
    [pipelines]
  );

  const checkSessionForMovingPipelineFiles = React.useCallback(
    async (combinedPaths: string[]): Promise<[boolean, PipelineMetaData[]]> => {
      if (!projectUuid) return [false, []];
      const { folderPaths, pipelineFilePaths } = combinedPaths.reduce(
        (all, dragPath) => {
          if (dragPath.endsWith("/"))
            all.folderPaths.push(unpackCombinedPath(dragPath));
          if (dragPath.endsWith(".orchest")) {
            all.pipelineFilePaths.push(unpackCombinedPath(dragPath));
          }
          return all;
        },
        {
          folderPaths: [] as UnpackedPath[],
          pipelineFilePaths: [] as UnpackedPath[],
        }
      );

      const foundPipelineFilePaths = await findPipelineFilePathsWithinFolders(
        projectUuid,
        folderPaths
      );

      const filePaths = [...pipelineFilePaths, ...foundPipelineFilePaths];

      if (filePaths.length === 0) return [true, []];

      const pipelinesWithSession: (IOrchestSessionUuid &
        PipelineMetaData)[] = [];

      for (let filePath of filePaths) {
        const foundPipeline = pipelineDics[filePath.path.replace(/^\//, "")];

        if (!foundPipeline) continue;

        const session = getSession({
          pipelineUuid: foundPipeline.uuid,
          projectUuid,
        });

        if (session) {
          pipelinesWithSession.push({
            ...foundPipeline,
            ...session,
          });
        }
      }

      if (pipelinesWithSession.length > 0) {
        setConfirm(
          "Warning",
          <Stack spacing={2} direction="column">
            <Box>
              Following pipeline files will also be moved. You need to stop
              their sessions before moving them. Do you want to proceed?
            </Box>
            <ul>
              {pipelinesWithSession.map((file) => (
                <Box key={file.path}>
                  <Code>{`Project files/${file.path}`}</Code>
                </Box>
              ))}
            </ul>
          </Stack>,
          {
            confirmLabel: `Stop session${
              pipelinesWithSession.length > 1 ? "s" : ""
            }`,
            onConfirm: async (resolve) => {
              await Promise.all(
                pipelinesWithSession.map((session) => toggleSession(session))
              );
              resolve(true);
              return true;
            },
          }
        );
      }

      return [pipelinesWithSession.length === 0, pipelinesWithSession];
    },
    [getSession, projectUuid, setConfirm, toggleSession, pipelineDics]
  );

  // by default, handleChangeFilePath will reload
  // when moving multiple files, we manually call reload after Promise.all
  const handleChangeFilePath = React.useCallback(
    async ({
      oldFilePath,
      newFilePath,
      pipelineUuid,
      skipReload = false,
    }: {
      oldFilePath: string;
      newFilePath: string;
      pipelineUuid?: string;
      skipReload?: boolean;
    }) => {
      if (!projectUuid) return;
      const params = getFilePathChangeParams(oldFilePath, newFilePath);
      try {
        await doChangeFilePath({ ...params, projectUuid, pipelineUuid });

        const isMovingPipelineFile = isFileByExtension(
          ["orchest"],
          params.newPath
        );

        // Moving a pipeline file from /data to /project-dir is equivalent to create new pipeline out of the .orchest file.
        // Thus, fire a fetch pipelines request to force BE to dicover the .orchest file.
        // and then update ProjectsContext and reload.
        const shouldReloadImmediately =
          isMovingPipelineFile && params.newRoot === "/project-dir";

        if (shouldReloadImmediately) {
          const updatedPipelines = await fetchPipelines(projectUuid);
          dispatch({ type: "SET_PIPELINES", payload: updatedPipelines });
          reload();
          return;
        }

        // If `.orchest` file is moved into `/data`, the pipeline cannot be opened.
        const shouldRemovePipeline =
          isMovingPipelineFile && params.newRoot === "/data";

        if (shouldRemovePipeline) {
          const pipelineFilePath = cleanFilePath(params.newPath);
          dispatch((current) => {
            const currentPipelines = current.pipelines || [];

            // Find the to-be-removed pipeline via path
            const pipelineToRemove = shouldRemovePipeline
              ? currentPipelines.find(
                  (p) => p.path === params.oldPath.replace(/^\//, "")
                )
              : undefined;

            const payload = shouldRemovePipeline
              ? currentPipelines.filter((pipeline) => {
                  return pipeline.uuid !== pipelineToRemove?.uuid;
                })
              : currentPipelines.map((pipeline) => {
                  return pipeline.uuid === pipelineUuid
                    ? { ...pipeline, path: pipelineFilePath }
                    : pipeline;
                });

            return {
              type: "SET_PIPELINES",
              payload,
            };
          });
        }

        const isEditingCurrentPipelineFile =
          pipelineUuid &&
          pipeline &&
          cleanFilePath(oldFilePath) === pipeline.path;

        if (isEditingCurrentPipelineFile) {
          dispatch({
            type: "UPDATE_PIPELINE",
            payload: { uuid: pipelineUuid, path: cleanFilePath(newFilePath) },
          });
        }

        onRename(oldFilePath, newFilePath);

        if (!skipReload) reload();

        return params;
      } catch (error) {
        setAlert(
          "Error",
          <>
            {`Failed to rename file `}
            <Code>{cleanFilePath(oldFilePath, "Project files/")}</Code>
            {`. ${error?.message || ""}`}
          </>
        );
      }
    },
    [onRename, dispatch, reload, setAlert, projectUuid, pipeline]
  );

  const startRename = React.useCallback(
    async (oldFilePath: string, newFilePath: string, skipReload = false) => {
      const [isSafeToProceed] = await checkSessionForMovingPipelineFiles([
        oldFilePath,
      ]);

      if (!isSafeToProceed || !pipeline) return;

      const foundPipeline = pipelineDics[pipeline.path];

      await handleChangeFilePath({
        oldFilePath,
        newFilePath,
        skipReload,
        pipelineUuid: foundPipeline.uuid,
      });
    },
    [
      pipeline,
      pipelineDics,
      handleChangeFilePath,
      checkSessionForMovingPipelineFiles,
    ]
  );

  const moveFiles = React.useCallback(
    async (deducedPaths: [string, string][]) => {
      const [sourcePath, targetPath] = deducedPaths[0];

      const [isSafeToProceed] = await checkSessionForMovingPipelineFiles(
        deducedPaths.map((paths) => paths[0]) // only check sourcePath
      );

      if (!isSafeToProceed) return;

      let targetDescription = generateTargetDescription(targetPath);

      const confirmMessage = (
        <>
          {`Do you want move `}
          {dragFiles.length > 1 ? (
            `${dragFiles.length} files`
          ) : (
            <Code>{baseNameFromPath(sourcePath)}</Code>
          )}
          {` to `}
          {targetDescription} ?
        </>
      );

      setConfirm("Warning", confirmMessage, async (resolve) => {
        await Promise.all(
          deducedPaths.map(async ([sourcePath, newPath]) => {
            const filePathRelativeToProjectDir = cleanFilePath(sourcePath);
            const foundPipeline = pipelines.find(
              (pipeline) => pipeline.path === filePathRelativeToProjectDir
            );

            const change = await handleChangeFilePath({
              oldFilePath: sourcePath,
              newFilePath: newPath,
              pipelineUuid: foundPipeline?.uuid,
              skipReload: true,
            });

            if (pipelineUuid && foundPipeline?.uuid === pipelineUuid) {
              dispatch({
                type: "UPDATE_PIPELINE",
                payload: { uuid: pipelineUuid, path: cleanFilePath(newPath) },
              });
            }

            return change;
          })
        );

        reload();
        resolve(true);
        return true;
      });
    },
    [
      dragFiles,
      dispatch,
      pipelineUuid,
      handleChangeFilePath,
      pipelines,
      reload,
      setConfirm,
      checkSessionForMovingPipelineFiles,
    ]
  );

  const handleDropInside = React.useCallback(
    async (targetPath: string) => {
      const deducedPaths = dragFiles.map((path) =>
        deduceRenameFromDragOperation(path, targetPath)
      );
      const hasPathChanged = deducedPaths.some(
        ([sourcePath, newPath]) => sourcePath !== newPath
      );

      if (!projectUuid || !hasPathChanged) return;

      // if user attempts to move .ipynb or .orchest files to /data
      if (isWithinDataFolder(targetPath)) {
        const foundPathWithForbiddenFiles = await Promise.all(
          dragFiles.map(async (dragFilePath) => {
            const foundFile = findFileViaPath(dragFilePath, fileTrees);
            const files = await findFilesByExtension({
              root: "/project-dir",
              projectUuid,
              extensions: ["ipynb", "orchest"],
              node: foundFile,
            });
            return files.length > 0;
          })
        );

        if (foundPathWithForbiddenFiles.some((response) => response)) {
          setConfirm(
            "Warning",
            <Stack spacing={2} direction="column">
              <Box>
                You are trying to move <Code>{".ipynb"}</Code>
                {` or `}
                <Code>{".orchest"}</Code>
                {` files into `}
                <Code>{"/data"}</Code> folder.
              </Box>
              <Box>
                {`Please note that these files cannot be opened within `}
                <Code>{"/data"}</Code>. Do you want to proceed?
              </Box>
            </Stack>,
            async (resolve) => {
              await Promise.all(
                deducedPaths.map(([sourcePath, newPath]) => {
                  // When moving a pipeline file, the pipelineUuid of this file should be used.
                  const pipelineUuidInPayload = !sourcePath.endsWith(".orchest")
                    ? pipelineUuid
                    : pipelines.find(
                        (pipeline) =>
                          pipeline.path === cleanFilePath(sourcePath)
                      )?.uuid;

                  return handleChangeFilePath({
                    oldFilePath: sourcePath,
                    newFilePath: newPath,
                    pipelineUuid: pipelineUuidInPayload,
                    skipReload: true,
                  });
                })
              );
              reload();
              resolve(true);
              return true;
            }
          );
          return;
        }
      }

      moveFiles(deducedPaths);
    },
    [
      dragFiles,
      fileTrees,
      setConfirm,
      projectUuid,
      pipelineUuid,
      pipelines,
      moveFiles,
      handleChangeFilePath,
      reload,
    ]
  );

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      // dropped outside of the tree view
      // PipelineViewport will take care of the operation
      if (!isInFileManager(target)) return;

      let targetFilePath = filePathFromHTMLElement(target);
      if (!targetFilePath) return;

      // dropped inside of the tree view
      if (dragFiles.length > 0) {
        handleDropInside(targetFilePath);
      }
    },

    [dragFiles, handleDropInside]
  );

  return (
    <>
      {isDragging && (
        <DragIndicator dragFiles={dragFiles} handleMouseUp={handleMouseUp} />
      )}
      <TreeView
        aria-label="file system navigator"
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        expanded={expanded}
        selected={selectedFiles}
        onNodeSelect={handleSelect}
        onNodeToggle={handleToggle}
        multiSelect
      >
        {treeRoots.map((root) => {
          let combinedPath = `${root}${ROOT_SEPARATOR}/`;
          return (
            <TreeItem
              disableDragging
              key={root}
              nodeId={root}
              sx={{
                backgroundColor:
                  hoveredPath === combinedPath
                    ? "rgba(0, 0, 0, 0.04)"
                    : undefined,
              }}
              data-path={combinedPath}
              labelText={root === "/project-dir" ? "Project files" : root}
            >
              <TreeRow
                setDragFile={setDragFile}
                treeNodes={fileTrees[root].children}
                hoveredPath={hoveredPath}
                root={root}
                onOpen={onOpen}
                handleRename={startRename}
              />
            </TreeItem>
          );
        })}
      </TreeView>
    </>
  );
});
