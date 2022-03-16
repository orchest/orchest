import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useDebounce } from "@/hooks/useDebounce";
import { Position } from "@/types";
import LinearProgress, {
  LinearProgressProps,
} from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileWithPath, useDropzone } from "react-dropzone";
import { ActionBar } from "./ActionBar";
import {
  FILE_MANAGER_ENDPOINT,
  FILE_MANAGER_ROOT_CLASS,
  getActiveRoot,
  isCombinedPathChildLess,
  mergeTrees,
  PROJECT_DIR_PATH,
  queryArgs,
  searchTrees,
  TreeNode,
  unpackCombinedPath,
} from "./common";
import { FileManagerContainer } from "./FileManagerContainer";
import { useFileManagerContext } from "./FileManagerContext";
import {
  ContextMenuMetadata,
  FileManagerContextMenu,
} from "./FileManagerContextMenu";
import { FileManagerLocalContextProvider } from "./FileManagerLocalContext";
import { FileTree } from "./FileTree";

/**
 * this function determines if the given file is a file uploaded via useDropzone
 * if true, the file has a property "path"
 * @param file File | FileWithPath
 * @returns boolean
 */
function isFileWithPath(file: File | FileWithPath): file is FileWithPath {
  return hasValue((file as FileWithPath).path);
}

const deepestExpand = (expanded: string[]) => {
  if (expanded.length === 0) {
    return 0;
  }
  return Math.max(
    ...expanded.map((e) => unpackCombinedPath(e).path.split("/").length - 1)
  );
};

const createInvalidEntryFilter = ({
  treeRoots,
  fileTrees,
}: {
  treeRoots: string[];
  fileTrees: Record<string, TreeNode>;
}) => (combinedPathList: string[]): [string[], boolean] => {
  let invalid = new Set();
  let foundInvalid = false;

  combinedPathList.forEach((combinedPath) => {
    if (
      searchTrees({ combinedPath, treeRoots, fileTrees }).node === undefined
    ) {
      foundInvalid = true;
      invalid.add(combinedPath);
    }
  });

  const uniqueArr = Array.from(new Set(combinedPathList));

  return [uniqueArr.filter((e) => !invalid.has(e)), foundInvalid];
};

type ProgressType = LinearProgressProps["variant"];
const DEFAULT_DEPTH = 3;

export function FileManager({
  onOpen,
  onDropOutside,
  ...props
}: {
  onSelect?: (selected: string[]) => void;
  onDropOutside: (target: EventTarget, dropPosition: Position) => void;
  onOpen: (filePath: string) => void;
  onEdit: (filePath: string) => void;
  onView: (filePath: string) => void;
  getDropPosition: () => Position;
}) {
  /**
   * States
   */
  const { projectUuid } = useCustomRoute();
  const {
    isDragging,
    selectedFiles,
    setSelectedFiles,
    fileTrees,
    setFileTrees,
  } = useFileManagerContext();

  const containerRef = React.useRef<HTMLElement>();

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const [expanded, setExpanded] = React.useState([PROJECT_DIR_PATH]);
  const [progress, setProgress] = React.useState(0);

  const [progressType, setProgressType] = React.useState<ProgressType>(
    "determinate"
  );
  const [contextMenu, setContextMenu] = React.useState<ContextMenuMetadata>(
    null
  );

  const fileManagerBaseUrl = React.useMemo(
    () => `${FILE_MANAGER_ENDPOINT}/${projectUuid}`,
    [projectUuid]
  );
  // Note, roots are assumed to always start with a / (absolute paths)
  const treeRoots = React.useMemo(() => [PROJECT_DIR_PATH, "/data"], []);
  const root = React.useMemo(() => getActiveRoot(selectedFiles, treeRoots), [
    selectedFiles,
    treeRoots,
  ]);

  /**
   * Actions
   */
  const reload = React.useCallback(async () => {
    setProgressType("determinate");
    setInProgress(true);

    // Load files on initial render
    const depth = Math.max(DEFAULT_DEPTH, deepestExpand(expanded));

    const newFiles = await Promise.all(
      treeRoots.map(async (root) => {
        const file = await fetcher(
          `${fileManagerBaseUrl}/browse?${queryArgs({
            depth,
            root,
          })}`
        );
        return { key: root, file };
      })
    );

    setFileTrees(
      newFiles.reduce((obj, curr) => {
        return { ...obj, [curr.key]: curr.file };
      }, {})
    );

    setInProgress(false);
  }, [expanded, treeRoots, fileManagerBaseUrl, setFileTrees]);

  const collapseAll = () => {
    setExpanded([]);
    setContextMenu(null);
  };

  const browsePath = React.useCallback(
    async (combinedPath) => {
      setProgressType("determinate");
      setInProgress(true);

      let { root, path } = unpackCombinedPath(combinedPath);

      const url = `${fileManagerBaseUrl}/browse?${queryArgs({
        path,
        root,
      })}`;

      const response = await fetcher(url);

      // Augment existing fileTree with path specific tree
      mergeTrees(response, fileTrees[root]);
      setFileTrees(fileTrees);
      setInProgress(false);
    },
    [fileTrees, fileManagerBaseUrl, setFileTrees]
  );

  const uploadFiles = React.useCallback(
    async (files: File[] | FileList) => {
      let progressTotal = files.length;
      const progressHolder = { progress: 0 };
      setInProgress(true);
      setProgressType("determinate");

      // ensure that we are handling File[] instead of FileList
      const promises = Array.from(files).map(
        async (file: File | FileWithPath) => {
          try {
            // Derive folder to upload the file to if webkitRelativePath includes a slash
            // (means the file was uploaded as a folder through drag or folder file selection)

            const isUploadedAsFolder = isFileWithPath(file)
              ? /.+\/.+/.test(file.path)
              : file.webkitRelativePath !== undefined &&
                file.webkitRelativePath.includes("/");

            let path = !isUploadedAsFolder
              ? "/"
              : `/${(isFileWithPath(file) ? file.path : file.webkitRelativePath)
                  .split("/")
                  .slice(0, -1)
                  .filter((value) => value.length > 0)
                  .join("/")}/`;

            let formData = new FormData();
            formData.append("file", file);

            await fetcher(
              `${fileManagerBaseUrl}/upload?${queryArgs({
                path,
                root,
              })}`,
              { method: "POST", body: formData }
            );

            progressHolder.progress += 1;
            let progressPercentage =
              (progressHolder.progress / progressTotal) * 100;
            setProgress(progressPercentage);
          } catch (error) {
            console.error(error);
            alert(error.message);
          }
        }
      );

      await Promise.all(promises);
      reload();
      setInProgress(false);
    },
    [reload, root, fileManagerBaseUrl]
  );

  /**
   * Callback handlers
   */

  const handleToggle = React.useCallback(
    (event: React.SyntheticEvent<Element, Event>, nodeIds: string[]) => {
      if (!isDragging) {
        // Newly expanded Ids
        let expandedSet = new Set(expanded);
        let addedIds = nodeIds.filter((e) => !expandedSet.has(e));

        // Note, nodeIds are absolute paths
        addedIds.forEach((combinedPath) => {
          if (isCombinedPathChildLess(combinedPath, fileTrees)) {
            // Attempt path load
            browsePath(combinedPath);
          }
        });

        setExpanded(nodeIds);
      }
    },
    [browsePath, expanded, fileTrees, isDragging]
  );

  /**
   * Final component init
   */
  const {
    acceptedFiles,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone();

  React.useEffect(() => {
    if (acceptedFiles.length > 0) uploadFiles(acceptedFiles);
  }, [uploadFiles, acceptedFiles]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const filterInvalidEntries = createInvalidEntryFilter({
      treeRoots,
      fileTrees,
    });
    // Check expansion/selection based
    let [newSelect, foundInvalidSelect] = filterInvalidEntries(selectedFiles);
    let [newExpanded, foundInvalidExpanded] = filterInvalidEntries(expanded);
    if (foundInvalidSelect) {
      setSelectedFiles(newSelect);
    }
    if (foundInvalidExpanded) {
      setExpanded(newExpanded);
    }
  }, [fileTrees]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTreesHaveLoaded = treeRoots.every((root) =>
    hasValue(fileTrees[root])
  );

  const onRename = React.useCallback(
    (oldPath: string, newPath: string) => {
      if (!selectedFiles.includes(newPath)) {
        setSelectedFiles((current) => {
          return [...current, newPath];
        });
      }

      // Expand if was expanded prior
      if (expanded.includes(oldPath) && !expanded.includes(newPath)) {
        setExpanded((expanded) => {
          return [...expanded, newPath];
        });
      }
    },
    [expanded, selectedFiles, setSelectedFiles]
  );

  return (
    <FileManagerLocalContextProvider
      reload={reload}
      setContextMenu={setContextMenu}
      baseUrl={fileManagerBaseUrl}
      {...props}
    >
      <Stack
        {...getRootProps({
          onClick: (event) => {
            event.stopPropagation();
          },
        })}
        ref={containerRef}
        className={FILE_MANAGER_ROOT_CLASS}
        direction="column"
        sx={{
          height: "100%",
          position: "relative",
          width: "300px",
          backgroundColor: (theme) => theme.palette.background.paper,
          borderRight: (theme) => `1px solid ${theme.borderColor}`,
          "::before": {
            content: '" "',
            position: "absolute",
            width: "calc(100% - 4px)",
            height: "calc(100% - 4px)",
            margin: "2px",
            pointerEvents: "none",
            border: (theme) =>
              isDragActive
                ? `2px dotted ${theme.palette.primary.light}`
                : undefined,
          },
        }}
      >
        <input {...getInputProps()} webkitdirectory="" directory="" />
        {inProgress && (
          <LinearProgress
            sx={{ position: "absolute", width: "100%" }}
            value={progress}
            variant={progressType}
          />
        )}
        <ActionBar
          baseUrl={fileManagerBaseUrl}
          setExpanded={setExpanded}
          reload={reload}
          uploadFiles={uploadFiles}
          rootFolder={root}
        />
        {allTreesHaveLoaded && (
          <FileManagerContainer>
            <FileTree
              baseUrl={fileManagerBaseUrl}
              treeRoots={treeRoots}
              expanded={expanded}
              onRename={onRename}
              handleToggle={handleToggle}
              reload={reload}
              onOpen={onOpen}
              onDropOutside={onDropOutside}
            />
            <FileManagerContextMenu metadata={contextMenu}>
              {contextMenu?.type === "background" && (
                <>
                  <MenuItem dense onClick={collapseAll}>
                    Collapse all
                  </MenuItem>
                  <MenuItem
                    dense
                    onClick={() => {
                      reload();
                      setContextMenu(null);
                    }}
                  >
                    Refresh
                  </MenuItem>
                </>
              )}
            </FileManagerContextMenu>
          </FileManagerContainer>
        )}
      </Stack>
    </FileManagerLocalContextProvider>
  );
}
