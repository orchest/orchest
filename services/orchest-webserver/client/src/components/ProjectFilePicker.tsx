import {
  getFilePathForRelativeToProject,
  prettifyRoot,
} from "@/pipeline-view/file-manager/common";
import { FileTree } from "@/types";
import { dirname, isDirectory, join } from "@/utils/path";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import CircularProgress from "@mui/material/CircularProgress";
import React from "react";
import { useFileManagerContext } from "../pipeline-view/file-manager/FileManagerContext";
import FilePicker, { FilePickerProps, validatePathInTree } from "./FilePicker";

const getAbsoluteFolderPath = ({
  value: relativeFilePath,
  cwd,
  tree,
}: Pick<FilePickerProps, "cwd" | "value" | "tree">) => {
  // The path for /data/ folder is absolute
  if (relativeFilePath.startsWith("/data/")) {
    return dirname(relativeFilePath.replace(/^\/data\//, "/data:/"));
  } else {
    const absCwd = `/project-dir:/${cwd === "/" ? "" : cwd}`;

    // The rest is a relative path to pipelineCwd
    const projectFilePath = join(absCwd, relativeFilePath);
    const directoryPath = isDirectory(projectFilePath)
      ? projectFilePath
      : dirname(projectFilePath);

    // Check if directoryPath exists.
    // If not, use pipelineCwd as fallback.
    return validatePathInTree(directoryPath, tree) ? directoryPath : absCwd;
  }
};

const ProjectFilePicker: React.FC<{
  pipelineCwd: string | undefined;
  value: string;
  onChange: (value: string) => void;
  menuMaxWidth?: string;
  allowedExtensions: readonly string[];
  doesFileExist: boolean;
  isCheckingFileValidity: boolean;
}> = ({
  onChange,
  pipelineCwd,
  value,
  menuMaxWidth,
  allowedExtensions,
  doesFileExist,
  isCheckingFileValidity,
}) => {
  // ProjectFilePicker uses the same endpoint for fetching FileTree
  const { fileTrees, fetchFileTrees } = useFileManagerContext();

  const tree = React.useMemo<FileTree>(() => {
    return {
      name: "",
      path: "",
      type: "directory",
      root: true, // This "root" is virtual, only for rendering UI. It does not reflect on the actual file tree in the file system.
      children: Object.entries(fileTrees).map(([key, rootTree]) => {
        return {
          ...rootTree,
          root: false,
          name: prettifyRoot(key),
          // Adding trailing ":/" to mark it as a root folder (note that the "root" of this tree is virtual, only for UI rendering).
          // for actual operations, we need to generate the right path by checking the actual roots: `/project-dir:/` and `/data:/`.
          path: `${key}:/`,
          depth: 0,
        };
      }),
    };
  }, [fileTrees]);

  const absoluteCwd = React.useMemo(() => {
    if (!pipelineCwd) return undefined;
    return getAbsoluteFolderPath({ cwd: pipelineCwd, value, tree });
  }, [pipelineCwd, value, tree]);

  const onSelectMenuItem = React.useCallback(
    (node: FileTree) => {
      // If depth is larger than current, refetch the trees
      if (node.type === "directory" && node.depth) {
        fetchFileTrees(node.depth + 1);
      }
    },
    [fetchFileTrees]
  );

  return (
    <>
      {tree && pipelineCwd && absoluteCwd && (
        <FilePicker
          tree={tree}
          cwd={pipelineCwd}
          value={value}
          absoluteCwd={absoluteCwd}
          allowedExtensions={allowedExtensions}
          icon={
            isCheckingFileValidity ? (
              <CircularProgress size={24} />
            ) : doesFileExist ? (
              <CheckIcon color="success" />
            ) : (
              <WarningIcon color="warning" />
            )
          }
          helperText={
            doesFileExist
              ? "File exists."
              : "Warning: this file wasn't found in the given path."
          }
          onChangeValue={onChange}
          menuMaxWidth={menuMaxWidth}
          onSelectMenuItem={onSelectMenuItem}
          generateRelativePath={getFilePathForRelativeToProject}
        />
      )}
    </>
  );
};

export default ProjectFilePicker;
