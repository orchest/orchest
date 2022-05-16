import { generateUploadFiles } from "@/components/DropZone";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useDebounce } from "@/hooks/useDebounce";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress, {
  LinearProgressProps,
} from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileManagementRoot, treeRoots } from "../common";
import { CreatePipelineDialog } from "../CreatePipelineDialog";
import { ActionBar } from "./ActionBar";
import {
  FILE_MANAGEMENT_ENDPOINT,
  getActiveRoot,
  isCombinedPathChildLess,
  lastSelectedFolderPath,
  mergeTrees,
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
import { FileTreeContainer } from "./FileTreeContainer";

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

export function FileManager() {
  /**
   * States
   */

  const {
    state: { projectUuid, pipelineIsReadOnly },
  } = useProjectsContext();

  const {
    isDragging,
    selectedFiles,
    setSelectedFiles,
    fileTrees,
    fetchFileTrees,
    setFileTrees,
  } = useFileManagerContext();

  const containerRef = React.useRef<typeof Stack | null>(null);

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

      let { root, path } = unpackCombinedPath(combinedPath);

      const url = `${FILE_MANAGEMENT_ENDPOINT}/browse?${queryArgs({
        project_uuid: projectUuid,
        root,
        path,
      })}`;

      const response = await fetcher<TreeNode>(url);

      // Augment existing fileTree with path specific tree
      mergeTrees(response, fileTrees[root]);
      setFileTrees(fileTrees);
      setInProgress(false);
    },
    [fileTrees, projectUuid, setFileTrees]
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
                  onRename={onRename}
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
        {!pipelineIsReadOnly && (
          <CreatePipelineDialog>
            {(onCreateClick) => (
              <Box
                sx={{
                  width: "100%",
                  margin: (theme) => theme.spacing(0.5, 0, 1, 0),
                  padding: (theme) => theme.spacing(1),
                }}
              >
                <Button
                  fullWidth
                  startIcon={<AddCircleIcon />}
                  onClick={onCreateClick}
                  data-test-id="pipeline-create"
                >
                  <Box
                    sx={{
                      marginTop: (theme) => theme.spacing(0.25),
                      marginRight: (theme) => theme.spacing(1),
                    }}
                  >
                    Create pipeline
                  </Box>
                </Button>
              </Box>
            )}
          </CreatePipelineDialog>
        )}
      </FileManagerContainer>
    </>
  );
}
