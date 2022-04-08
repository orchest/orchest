import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { siteMap } from "@/Routes";
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
  generateTargetDescription,
  isFileByExtension,
  isWithinDataFolder,
  queryArgs,
  ROOT_SEPARATOR,
  unpackCombinedPath,
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

const doChangeFilePath = ({
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
  if (params.newPath.endsWith(".orchest")) {
    if (!pipelineUuid) throw new Error("pipeline_uuid is required.");
    return sendChangePipelineFilePathRequest(
      projectUuid,
      pipelineUuid,
      params.newPath
    );
  } else {
    return sendChangeFilePathRequest({ ...params, projectUuid });
  }
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
    selectedFiles,
    dragFile,
    setDragFile,
    hoveredPath,
    isDragging,
    fileTrees,
    setFilePathChanges,
    pipelines,
  } = useFileManagerContext();

  const { handleSelect, reload } = useFileManagerLocalContext();

  const openNotebook = useOpenNoteBook();

  const onOpen = React.useCallback(
    (filePath) => {
      if (
        isWithinDataFolder(filePath) &&
        isFileByExtension(["orchest", "ipynb"], filePath)
      ) {
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
      const params = getFilePathChangeParams(oldFilePath, newFilePath);
      try {
        await doChangeFilePath({ ...params, projectUuid, pipelineUuid });

        onRename(oldFilePath, newFilePath);

        if (!skipReload) {
          setFilePathChanges([params]);
          reload();
        }
        return params;
      } catch (error) {
        setAlert(
          "Error",
          <>
            {`Failed to rename file `}{" "}
            <Code>{cleanFilePath(oldFilePath, "Project files/")}</Code>
            {`. ${error?.message || ""}`}
          </>
        );
      }
    },
    [onRename, reload, setAlert, setFilePathChanges, projectUuid]
  );

  const startRename = React.useCallback(
    (oldFilePath: string, newFilePath: string, skipReload = false) => {
      const filePathRelativeToProjectDir = cleanFilePath(oldFilePath);
      const foundPipeline = pipelines.find(
        (pipeline) => pipeline.path === filePathRelativeToProjectDir
      );
      const session = foundPipeline
        ? getSession({ pipelineUuid: foundPipeline.uuid, projectUuid })
        : null;

      if (session) {
        setConfirm(
          "Warning",
          <>
            {`Before renaming `}
            <Code>{cleanFilePath(oldFilePath, "Project files/")}</Code>
            {` , you need to stop its session. Do you want to continue?`}
          </>,
          {
            confirmLabel: "Stop session",
            onConfirm: async (resolve) => {
              toggleSession(session);
              resolve(true);
              return true;
            },
          }
        );
        return;
      }

      handleChangeFilePath({
        oldFilePath,
        newFilePath,
        skipReload,
        pipelineUuid: foundPipeline.uuid,
      });
    },
    [
      setConfirm,
      handleChangeFilePath,
      pipelines,
      projectUuid,
      getSession,
      toggleSession,
    ]
  );

  const moveFiles = React.useCallback(
    (deducedPaths: [string, string][]) => {
      const [sourcePath, targetPath] = deducedPaths[0];
      let targetDescription = generateTargetDescription(targetPath);
      const confirmMessage =
        dragFiles.length > 1 ? (
          <>
            {`Do you want move `}
            {dragFiles.length}
            {` files to `}
            {targetDescription} ?
          </>
        ) : (
          <>
            {`Do you want move `}
            <Code>{baseNameFromPath(sourcePath)}</Code>
            {` to `}
            {targetDescription} ?
          </>
        );

      setConfirm("Warning", confirmMessage, async (resolve) => {
        const newFilePathChanges = await Promise.all(
          deducedPaths.map(([sourcePath, newPath]) => {
            const filePathRelativeToProjectDir = cleanFilePath(sourcePath);
            const foundPipeline = pipelines.find(
              (pipeline) => pipeline.path === filePathRelativeToProjectDir
            );

            return handleChangeFilePath({
              oldFilePath: sourcePath,
              newFilePath: newPath,
              pipelineUuid: foundPipeline?.uuid,
              skipReload: true,
            });
          })
        );
        setFilePathChanges(newFilePathChanges);
        reload();
        resolve(true);
        return true;
      });
    },
    [
      dragFiles,
      handleChangeFilePath,
      pipelines,
      reload,
      setConfirm,
      setFilePathChanges,
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

      if (!hasPathChanged) return;

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
              const newFilePathChanges = await Promise.all(
                deducedPaths.map(([sourcePath, newPath]) => {
                  return handleChangeFilePath({
                    oldFilePath: sourcePath,
                    newFilePath: newPath,
                    pipelineUuid,
                    skipReload: true,
                  });
                })
              );
              setFilePathChanges(newFilePathChanges);
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
      moveFiles,
      handleChangeFilePath,
      reload,
      setFilePathChanges,
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
