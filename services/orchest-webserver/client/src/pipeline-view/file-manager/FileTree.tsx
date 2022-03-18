import { Code } from "@/components/common/Code";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { Position } from "@/types";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TreeView from "@mui/lab/TreeView";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import {
  baseNameFromPath,
  deduceRenameFromDragOperation,
  filePathFromHTMLElement,
  FILE_MANAGER_ROOT_CLASS,
  generateTargetDescription,
  isFileByExtension,
  isFromDataFolder,
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
      `/async/file-manager/${projectUuid}/extension-search?${queryArgs({
        path: node.path,
        extensions: extensions.join(","),
      })}`
    );

    return response.files.length > 0;
  }
};

export const FileTree = React.memo(function FileTreeComponent({
  baseUrl,
  treeRoots,
  expanded,
  handleToggle,
  onRename,
  reload,
  onDropOutside,
  onOpen,
}: {
  baseUrl: string;
  treeRoots: string[];
  expanded: string[];
  handleToggle: (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => void;
  onRename: (oldPath: string, newPath: string) => void;
  reload: () => void;
  onDropOutside: (target: EventTarget, dropPosition: Position) => void;
  onOpen: (filePath: string) => void;
}) {
  const { setConfirm, setAlert } = useAppContext();

  const { projectUuid } = useCustomRoute();

  const {
    selectedFiles,
    dragFile,
    setDragFile,
    hoveredPath,
    isDragging,
    setIsDragging,
    fileTrees,
    setFilePathChanges,
  } = useFileManagerContext();
  const { getDropPosition, handleSelect } = useFileManagerLocalContext();

  const dragFiles = React.useMemo(() => {
    if (!dragFile) return [];

    const dragFilesSet = new Set(selectedFiles);
    if (dragFile) dragFilesSet.add(dragFile.path);
    return [...dragFilesSet];
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

      const url = `${baseUrl}/rename?${queryArgs({
        oldPath,
        newPath,
        oldRoot,
        newRoot,
      })}`;

      try {
        await fetcher(url, { method: "POST" });
        if (!skipReload) {
          setFilePathChanges([{ oldPath, newPath, oldRoot, newRoot }]);
          reload();
        }
        return { oldPath, newPath, oldRoot, newRoot };
      } catch (error) {
        setAlert("Error", `Failed to rename file ${oldPath}. ${error.message}`);
      }
    },
    [onRename, baseUrl, reload, setAlert, setFilePathChanges]
  );

  const moveFiles = React.useCallback(
    (targetPath: string) => {
      const deducedPaths = dragFiles.map((path) =>
        deduceRenameFromDragOperation(path, targetPath)
      );
      const hasPathChanged = deducedPaths.some(
        ([sourcePath, newPath]) => sourcePath !== newPath
      );
      // Check if any path changes
      if (hasPathChanged) {
        let targetDescription = generateTargetDescription(deducedPaths[0][1]);
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
              <Code>{baseNameFromPath(deducedPaths[0][0])}</Code>
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
      }
    },
    [dragFiles, handleRename, reload, setConfirm, setFilePathChanges]
  );

  const handleDropInside = React.useCallback(
    async (targetPath: string) => {
      // if user attempts to move .ipynb or .orchest files to /data
      if (isFromDataFolder(targetPath)) {
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
            (resolve) => {
              moveFiles(targetPath);
              resolve(true);
              return true;
            }
          );
          return;
        }
      }

      moveFiles(targetPath);
    },
    [dragFiles, fileTrees, setConfirm, projectUuid, moveFiles]
  );

  const handleMouseUp = React.useCallback(
    (target: HTMLElement) => {
      // dropped outside of the tree view
      if (!isInFileManager(target)) {
        onDropOutside(target, getDropPosition());
        return;
      }

      let targetFilePath = filePathFromHTMLElement(target);
      if (!targetFilePath) return;

      // dropped inside of the tree view
      if (dragFiles.length > 0) {
        handleDropInside(targetFilePath);
      }
    },
    [onDropOutside, dragFiles, getDropPosition, handleDropInside]
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
                setIsDragging={setIsDragging}
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
