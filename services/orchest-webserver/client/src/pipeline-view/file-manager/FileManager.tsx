import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useDebounce } from "@/hooks/useDebounce";
import { Position } from "@/types";
import Box from "@mui/material/Box";
import LinearProgress, {
  LinearProgressProps,
} from "@mui/material/LinearProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useDropzone } from "react-dropzone";
import { ActionBar } from "./ActionBar";
import {
  baseNameFromPath,
  customFileGetter,
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
import { FileTree } from "./FileTree";

const getBaseNameFromContextMenu = (contextMenuCombinedPath: string) => {
  let pathComponents = contextMenuCombinedPath.split("/");
  if (contextMenuCombinedPath.endsWith("/")) {
    pathComponents = pathComponents.slice(0, -1);
  }
  return pathComponents.slice(-1)[0];
};

const downloadFile = (
  url: string,
  combinedPath: string,
  downloadLink: string
) => {
  let { root, path } = unpackCombinedPath(combinedPath);

  let downloadUrl = `${url}/download?${queryArgs({
    path,
    root,
  })}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = downloadLink;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

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

type FileTrees = Record<string, TreeNode>;
type ProgressType = LinearProgressProps["variant"];
type ContextMenuType = "tree-item" | "background";

export function FileManager({
  onSelect,
  onDropOutside,
  onOpen,
  onView,
  onEdit,
}: {
  onSelect: (selected: string[]) => void;
  onDropOutside: (target: EventTarget, selection: string[]) => void;
  onOpen: (filePath: string) => void;
  onEdit: (filePath: string) => void;
  onView: (filePath: string) => void;
}) {
  /**
   * Define configuration constants
   */
  const DEFAULT_DEPTH = 3;
  const containerRef = React.useRef<HTMLElement>();
  /**
   * State init
   */
  const { projectUuid } = useCustomRoute();
  const { setConfirm } = useAppContext();

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const [fileTrees, setFileTrees] = React.useState<FileTrees>({});
  const [expanded, setExpanded] = React.useState([PROJECT_DIR_PATH]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fileInRename, setFileInRename] = React.useState<string>(undefined);
  const [fileRenameNewName, setFileRenameNewName] = React.useState("");

  const [progressType, setProgressType] = React.useState<ProgressType>(
    "determinate"
  );
  const [contextMenu, setContextMenu] = React.useState<{
    position: Position;
    type: ContextMenuType;
  } | null>(null);
  const [contextMenuCombinedPath, setContextMenuPath] = React.useState<
    string
  >();

  const fileManagerBaseUrl = `${FILE_MANAGER_ENDPOINT}/${projectUuid}`;
  // Note, roots are assumed to always start with a / (absolute paths)
  const treeRoots = React.useMemo(() => [PROJECT_DIR_PATH, "/data"], []);
  const root = React.useMemo(() => getActiveRoot(selected, treeRoots), [
    selected,
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
  }, [expanded, treeRoots, fileManagerBaseUrl]);

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
    [fileTrees, fileManagerBaseUrl]
  );

  const uploadFiles = React.useCallback(
    async (files: File[] | FileList) => {
      let progressTotal = files.length;
      const progressHolder = { progress: 0 };
      setInProgress(true);
      setProgressType("determinate");

      // ensure that we are handling File[] instead of FileList
      const promises = Array.from(files).map(async (file) => {
        try {
          // Derive folder to upload the file to if webkitRelativePath includes a slash
          // (means the file was uploaded as a folder through drag or folder file selection)
          const isUploadedAsFolder =
            file.webkitRelativePath !== undefined &&
            file.webkitRelativePath.includes("/");

          let path = !isUploadedAsFolder
            ? "/"
            : `/${file.webkitRelativePath.split("/").slice(0, -1).join("/")}/`;

          let formData = new FormData();
          formData.append("file", file);

          await fetcher(
            `${fileManagerBaseUrl}/upload?${queryArgs({
              path,
              root,
            })}`,
            {
              method: "POST",
              headers: HEADER.FORM,
              body: formData,
            }
          );
          progressHolder.progress += 1;
          let progressPercentage =
            (progressHolder.progress / progressTotal) * 100;
          setProgress(progressPercentage);
        } catch (error) {
          console.error(error);
          alert(error.message);
        }
      });

      await Promise.all(promises);
      reload();
      setInProgress(false);
    },
    [reload, root, fileManagerBaseUrl]
  );

  const deleteFetch = React.useCallback(
    (combinedPath) => {
      let { root, path } = unpackCombinedPath(combinedPath);
      return fetch(
        `${fileManagerBaseUrl}/delete?${queryArgs({
          path,
          root,
        })}`,
        { method: "POST" }
      );
    },
    [fileManagerBaseUrl]
  );

  /**
   * Callback handlers
   */
  const handleClose = () => {
    setContextMenu(null);
  };

  const handleToggle = (
    event: React.SyntheticEvent<Element, Event>,
    nodeIds: string[]
  ) => {
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
  };

  const handleSelect = (
    event: React.SyntheticEvent<Element, Event>,
    selected: string[]
  ) => {
    if (onSelect) onSelect(selected);
    setSelected(selected);
  };

  const handleDelete = React.useCallback(() => {
    handleClose();

    if (selected.includes(contextMenuCombinedPath) && selected.length > 1) {
      setConfirm(
        "Warning",
        `Are you sure you want to delete ${selected.length} files?`,
        async (resolve) => {
          await Promise.all(
            selected.map((combinedPath) => deleteFetch(combinedPath))
          );
          await reload();
          resolve(true);
          return true;
        }
      );
      return;
    }

    setConfirm(
      "Warning",
      `Are you sure you want to delete '${getBaseNameFromContextMenu(
        contextMenuCombinedPath
      )}'?`,
      async (resolve) => {
        await deleteFetch(contextMenuCombinedPath);
        await reload();
        resolve(true);
        return true;
      }
    );
  }, [contextMenuCombinedPath, selected, reload, deleteFetch, setConfirm]);

  const handleDownload = () => {
    handleClose();

    const downloadLink = getBaseNameFromContextMenu(contextMenuCombinedPath);

    if (selected.includes(contextMenuCombinedPath)) {
      selected.forEach((combinedPath, i) => {
        setTimeout(function () {
          downloadFile(fileManagerBaseUrl, combinedPath, downloadLink);
        }, i * 500);
        // Seems like multiple download invocations works with 500ms
        // Not the most reliable, might want to fall back to server side zip.
      });
    } else {
      downloadFile(fileManagerBaseUrl, contextMenuCombinedPath, downloadLink);
    }
  };

  const handleContextMenu = (
    event: React.MouseEvent,
    combinedPath: string,
    type: ContextMenuType = "tree-item"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPath(combinedPath);
    setContextMenu(
      contextMenu === null
        ? {
            position: {
              x: event.clientX - 2,
              y: event.clientY - 4,
            },
            type,
          }
        : null
    );
  };

  const handleDuplicate = async () => {
    handleClose();

    let { root, path } = unpackCombinedPath(contextMenuCombinedPath);

    await fetch(
      `${fileManagerBaseUrl}/duplicate?${queryArgs({
        path,
        root,
      })}`,
      { method: "POST" }
    );
    reload();
  };

  const handleContextRename = () => {
    handleClose();
    setFileInRename(contextMenuCombinedPath);
    setFileRenameNewName(baseNameFromPath(contextMenuCombinedPath));
  };

  const handleContextView = () => {
    handleClose();
    onView(contextMenuCombinedPath);
  };

  const handleContextEdit = () => {
    handleClose();
    onEdit(contextMenuCombinedPath);
  };

  const handleRename = React.useCallback(
    async (oldCombinedPath, newCombinedPath) => {
      let { root: oldRoot, path: oldPath } = unpackCombinedPath(
        oldCombinedPath
      );
      let { root: newRoot, path: newPath } = unpackCombinedPath(
        newCombinedPath
      );

      if (!selected.includes(newCombinedPath)) {
        setSelected((selected) => {
          return [...selected, newCombinedPath];
        });
      }

      // Expand if was expanded prior
      if (
        expanded.includes(oldCombinedPath) &&
        !expanded.includes(newCombinedPath)
      ) {
        setExpanded((expanded) => {
          return [...expanded, newCombinedPath];
        });
      }

      const url = `${fileManagerBaseUrl}/rename?${queryArgs({
        oldPath,
        newPath,
        oldRoot,
        newRoot,
      })}`;

      await fetcher(url, { method: "POST" });
      reload();
    },
    [reload, expanded, selected, fileManagerBaseUrl]
  );

  /**
   * Final component init
   */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
    getFilesFromEvent: customFileGetter,
  });

  React.useEffect(() => {
    reload();
  }, [reload]);

  React.useEffect(() => {
    const filterInvalidEntries = createInvalidEntryFilter({
      treeRoots,
      fileTrees,
    });
    // Check expansion/selection based
    let [newSelect, foundInvalidSelect] = filterInvalidEntries(selected);
    let [newExpanded, foundInvalidExpanded] = filterInvalidEntries(expanded);
    if (foundInvalidSelect) {
      setSelected(newSelect);
    }
    if (foundInvalidExpanded) {
      setExpanded(newExpanded);
    }
  }, [fileTrees]); // eslint-disable-line react-hooks/exhaustive-deps

  const allTreesHaveLoaded = treeRoots
    .map((root) => fileTrees[root])
    .every((fileTree) => fileTree !== undefined);

  const contextPathIsFile =
    contextMenuCombinedPath && !contextMenuCombinedPath.endsWith("/");

  return (
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
          pointerEvents: "none",
          border: (theme) =>
            isDragActive
              ? `2px solid ${theme.palette.primary.main}`
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
        setSelected={setSelected}
        reload={reload}
        uploadFiles={uploadFiles}
        rootFolder={root}
      />
      {allTreesHaveLoaded && (
        <Box
          sx={{
            userSelect: "none",
            whiteSpace: "nowrap",
            maxHeight: "100%",
            overflowY: "auto",
            flex: 1,
          }}
          onContextMenu={(e) => {
            handleContextMenu(e, undefined, "background");
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.detail === 1 && !(e.metaKey || e.ctrlKey)) {
              setSelected([]);
            }
          }}
        >
          <FileTree
            fileTrees={fileTrees}
            treeRoots={treeRoots}
            expanded={expanded}
            selected={selected}
            handleContextMenu={handleContextMenu}
            handleSelect={handleSelect}
            handleToggle={handleToggle}
            handleRename={handleRename}
            onOpen={onOpen}
            onDropOutside={onDropOutside}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            fileInRename={fileInRename}
            setFileInRename={setFileInRename}
            fileRenameNewName={fileRenameNewName}
            setFileRenameNewName={setFileRenameNewName}
          />
          <Menu
            open={contextMenu !== null}
            onClose={handleClose}
            anchorReference="anchorPosition"
            anchorPosition={
              contextMenu !== null
                ? {
                    top: contextMenu?.position.y,
                    left: contextMenu?.position.x,
                  }
                : undefined
            }
          >
            {contextMenu?.type === "tree-item" && (
              <>
                {contextPathIsFile && (
                  <MenuItem dense onClick={handleContextEdit}>
                    Edit
                  </MenuItem>
                )}
                {contextPathIsFile && (
                  <MenuItem dense onClick={handleContextView}>
                    View
                  </MenuItem>
                )}
                <MenuItem dense onClick={handleContextRename}>
                  Rename
                </MenuItem>
                <MenuItem dense onClick={handleDuplicate}>
                  Duplicate
                </MenuItem>
                <MenuItem dense onClick={handleDelete}>
                  Delete
                </MenuItem>
                <MenuItem dense onClick={handleDownload}>
                  Download
                </MenuItem>
              </>
            )}
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
          </Menu>
        </Box>
      )}
    </Stack>
  );
}
