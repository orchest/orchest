import { generateUploadFiles } from "@/components/DropZone";
import { useDebounce } from "@/hooks/useDebounce";
import LinearProgress, {
  LinearProgressProps,
} from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot, treeRoots } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { CreatePipelineDialog } from "../CreatePipelineDialog";
import { ActionBar } from "./ActionBar";
import {
  FILE_MANAGEMENT_ENDPOINT,
  getActiveRoot,
  isCombinedPathChildless,
  lastSelectedFolderPath,
  mergeTrees,
  queryArgs,
  searchTrees,
  TreeNode,
  unpackPath,
} from "./common";
import { CreatePipelineButton } from "./CreatePipelineButton";
import { FileManagerContainer } from "./FileManagerContainer";
import { useFileManagerContext } from "./FileManagerContext";
import {
  ContextMenuMetadata,
  FileManagerContextMenu,
} from "./FileManagerContextMenu";
import { FileManagerLocalContextProvider } from "./FileManagerLocalContext";
import { FileTree } from "./FileTree";
import { FileTreeContainer } from "./FileTreeContainer";

const deepestExpand = (expanded: string[]) => {
  if (expanded.length === 0) {
    return 0;
  }
  return Math.max(
    ...expanded.map((e) => unpackPath(e).path.split("/").length - 1)
  );
};

const createInvalidEntryFilter = ({
  treeRoots,
  fileTrees,
}: {
  treeRoots: readonly FileManagementRoot[];
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

export function FileManager() {
  /**
   * States
   */

  const {
    projectUuid,
    isReadOnly,
    pipelineUuid,
    jobUuid,
    runUuid,
  } = usePipelineDataContext();

  const {
    isDragging,
    selectedFiles,
    setSelectedFiles,
    fileTrees,
    fetchFileTrees,
    setFileTrees,
  } = useFileManagerContext();

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // only show the progress if it takes longer than 125 ms
  const [_inProgress, setInProgress] = React.useState(false);
  const inProgress = useDebounce(_inProgress, 125);

  const [expanded, setExpanded] = React.useState<
    (FileManagementRoot | string)[]
  >(["/project-dir"]);
  const [progress, setProgress] = React.useState(0);

  const [progressType, setProgressType] = React.useState<ProgressType>(
    "determinate"
  );
  const [contextMenu, setContextMenu] = React.useState<ContextMenuMetadata>(
    undefined
  );

  const root = React.useMemo(() => getActiveRoot(selectedFiles, treeRoots), [
    selectedFiles,
  ]);

  /**
   * Actions
   */
  const reload = React.useCallback(async () => {
    setProgressType("determinate");
    setInProgress(true);

    await fetchFileTrees(deepestExpand(expanded));

    setInProgress(false);
  }, [expanded, fetchFileTrees]);

  const collapseAll = () => {
    setExpanded([]);
    setContextMenu(undefined);
  };

  const browsePath = React.useCallback(
    async (combinedPath) => {
      if (!projectUuid) return;
      setProgressType("determinate");
      setInProgress(true);

      const { root, path } = unpackPath(combinedPath);

      const url = `${FILE_MANAGEMENT_ENDPOINT}/browse?${queryArgs({
        projectUuid,
        pipelineUuid,
        jobUuid,
        runUuid,
        root,
        path,
      })}`;

      const response = await fetcher<TreeNode>(url);

      // Augment existing fileTree with path specific tree
      mergeTrees(response, fileTrees[root]);
      setFileTrees(fileTrees);
      setInProgress(false);
    },
    [fileTrees, projectUuid, setFileTrees, jobUuid, pipelineUuid, runUuid]
  );

  const doUploadFiles = React.useCallback(
    (files: File[] | FileList, onUploaded: () => void) => {
      if (!projectUuid) return;
      const lastSelectedFolder = lastSelectedFolderPath(selectedFiles);
      return Promise.all(
        generateUploadFiles({
          projectUuid,
          root,
          path: lastSelectedFolder,
          isProjectUpload: false,
        })(files, onUploaded)
      );
    },
    [projectUuid, selectedFiles, root]
  );

  const uploadFiles = React.useCallback(
    async (files: File[] | FileList) => {
      let progressTotal = files.length;
      const progressHolder = { progress: 0 };
      setInProgress(true);
      setProgressType("determinate");

      await doUploadFiles(files, () => {
        progressHolder.progress += 1;
        let progressPercentage = Math.round(
          (progressHolder.progress / progressTotal) * 100
        );
        setProgress(progressPercentage);
      });

      reload();
      setInProgress(false);
    },
    [reload, doUploadFiles]
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
          if (isCombinedPathChildless(combinedPath, fileTrees)) {
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

  React.useEffect(() => {
    reload();
    // Only load once when on mount.
    // Put `reload` in the deps would trigger unwanted requests.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onMoved = React.useCallback(
    (oldPath: string, newPath: string) => {
      if (!selectedFiles.includes(newPath)) {
        setSelectedFiles((current) => {
          return [...current, newPath];
        });
      }

      const wasExpandedBeforeMove =
        expanded.includes(oldPath) && !expanded.includes(newPath);

      if (wasExpandedBeforeMove) {
        setExpanded((expanded) => {
          return [...expanded, newPath];
        });
      }
    },
    [expanded, selectedFiles, setSelectedFiles]
  );

  return (
    <>
      <FileManagerContainer ref={containerRef} uploadFiles={uploadFiles}>
        {inProgress && (
          <LinearProgress
            sx={{ position: "absolute", width: "100%" }}
            value={progress}
            variant={progressType}
          />
        )}
        <FileManagerLocalContextProvider
          reload={reload}
          setContextMenu={setContextMenu}
        >
          {!isReadOnly && (
            <CreatePipelineDialog>
              {(onCreateClick) => (
                <CreatePipelineButton onClick={onCreateClick} />
              )}
            </CreatePipelineDialog>
          )}
          <ActionBar
            setExpanded={setExpanded}
            uploadFiles={uploadFiles}
            rootFolder={root}
          />
          <FileTreeContainer>
            {allTreesHaveLoaded && (
              <>
                <FileTree
                  treeRoots={treeRoots}
                  expanded={expanded}
                  onMoved={onMoved}
                  handleToggle={handleToggle}
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
                          setContextMenu(undefined);
                        }}
                      >
                        Refresh
                      </MenuItem>
                    </>
                  )}
                </FileManagerContextMenu>
              </>
            )}
          </FileTreeContainer>
        </FileManagerLocalContextProvider>
      </FileManagerContainer>
    </>
  );
}
