import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchPipelines } from "@/hooks/useFetchPipelines";
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
  FILE_MANAGEMENT_ENDPOINT,
  FILE_MANAGER_ROOT_CLASS,
  generateTargetDescription,
  isFileByExtension,
  isWithinDataFolder,
  PROJECT_DIR_PATH,
  queryArgs,
  ROOT_SEPARATOR,
  TreeNode,
  unpackCombinedPath,
} from "./common";
import { DragIndicator } from "./DragIndicator";
import { FileTrees, useFileManagerContext } from "./FileManagerContext";
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

const containsFilesByExtension = async (
  projectUuid: string,
  extensions: string[],
  node: TreeNode
) => {
  if (node.type === "file") return isFileByExtension(extensions, node.name);
  if (node.type === "directory") {
    const response = await fetcher<{ files: string[] }>(
      `/async/file-management/extension-search?${queryArgs({
        project_uuid: projectUuid,
        root: PROJECT_DIR_PATH, // note: root should either be /data or /project-dir
        path: node.path,
        extensions: extensions.join(","),
      })}`
    );

    return response.files.length > 0;
  }
};

// ancesterPath has to be an folder because a file cannot be a parent
const isAncester = (ancesterPath: string, childPath: string) =>
  ancesterPath.endsWith("/") && childPath.startsWith(ancesterPath);

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

  const {
    selectedFiles,
    dragFile,
    setDragFile,
    hoveredPath,
    isDragging,
    fileTrees,
    setFilePathChanges,
  } = useFileManagerContext();

  const { handleSelect, reload } = useFileManagerLocalContext();

  const openNotebook = useOpenNoteBook();

  const { pipelines } = useFetchPipelines(projectUuid);

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

  // dragFiles cannot have nodes that are ancester/offspring of each other
  // because offspring nodes will be moved along with their ancesters.
  // e.g. given selection ["/a/", "/a/b.py"], "/a/b.py" should be removed
  const dragFiles = React.useMemo(() => {
    if (!dragFile) return [];

    const filteredItemsSet = new Set<string>([dragFile.path]);

    for (let selectedPath of selectedFiles) {
      const filteredItems = [...filteredItemsSet];

      // If filteredItem is an ancestor of selectedPath
      const hasIncluded = filteredItems.some((filteredItem) =>
        isAncester(filteredItem, selectedPath)
      );

      if (hasIncluded) continue;

      // Replace the current item with its ancester.
      filteredItems.forEach((filteredItem) => {
        if (isAncester(selectedPath, filteredItem)) {
          filteredItemsSet.delete(filteredItem);
          filteredItemsSet.add(selectedPath);
        }
      });

      // If selectedPath is not an ancester or an offspring of any item in filteredItems,
      // add it into the list.
      filteredItemsSet.add(selectedPath);
    }

    return [...filteredItemsSet];
  }, [dragFile, selectedFiles]);

  // by default, handleRename will reload
  // when moving multiple files, we manually call reload after Promise.all
  const handleRename = React.useCallback(
    async (oldCombinedPath, newCombinedPath, skipReload = false) => {
      let { root: oldRoot, path: oldPath } = unpackCombinedPath(
        oldCombinedPath
      );
      let { root: newRoot, path: newPath } = unpackCombinedPath(
        newCombinedPath
      );

      onRename(oldCombinedPath, newCombinedPath);

      try {
        if (newPath.endsWith(".orchest")) {
          await fetcher(`/async/pipelines/${projectUuid}/${pipelineUuid}`, {
            method: "PUT",
            headers: HEADER.JSON,
            body: JSON.stringify({ path: newPath.replace(/^\//, "") }), // cannot contain the leading slash
          });
        } else {
          await fetcher(
            `${FILE_MANAGEMENT_ENDPOINT}/rename?${queryArgs({
              old_path: oldPath,
              new_path: newPath,
              old_root: oldRoot,
              new_root: newRoot,
              project_uuid: projectUuid,
            })}`,
            { method: "POST" }
          );
        }

        if (!skipReload) {
          setFilePathChanges([{ oldPath, newPath, oldRoot, newRoot }]);
          reload();
        }
        return { oldPath, newPath, oldRoot, newRoot };
      } catch (error) {
        // TODO: give a more meaninfule error message.
        setAlert("Error", `Failed to rename file ${oldPath}. Invalid path.`);
      }
    },
    [onRename, reload, setAlert, setFilePathChanges, pipelineUuid, projectUuid]
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
            return handleRename(sourcePath, newPath, true);
          })
        );
        setFilePathChanges(newFilePathChanges);
        reload();
        resolve(true);
        return true;
      });
    },
    [dragFiles, handleRename, reload, setConfirm, setFilePathChanges]
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
          dragFiles.map((dragFilePath) => {
            const foundFile = findFileViaPath(dragFilePath, fileTrees);
            return containsFilesByExtension(
              projectUuid,
              ["ipynb", "orchest"],
              foundFile
            );
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
                  return handleRename(sourcePath, newPath, true);
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
      moveFiles,
      handleRename,
      reload,
      setFilePathChanges,
    ]
  );

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      // dropped outside of the tree view
      // PipelineViewport will take care of the operation
      if (!isInFileManager(target)) {
        return;
      }

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
              labelText={root === PROJECT_DIR_PATH ? "Project files" : root}
            >
              <TreeRow
                setDragFile={setDragFile}
                treeNodes={fileTrees[root].children}
                hoveredPath={hoveredPath}
                root={root}
                onOpen={onOpen}
                handleRename={handleRename}
              />
            </TreeItem>
          );
        })}
      </TreeView>
    </>
  );
});
