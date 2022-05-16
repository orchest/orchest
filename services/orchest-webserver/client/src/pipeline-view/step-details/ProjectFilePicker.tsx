import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { FileTree } from "@/types";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import { collapseDoubleDots } from "@orchest/lib-utils";
import React from "react";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import FilePicker, { FilePickerProps, validatePathInTree } from "./FilePicker";

const getFolderPath = (filePath: string) =>
  filePath.split("/").slice(0, -1).join("/") + "/";

const getAbsoluteFolderPath = ({
  value: relativeFilePath,
  cwd,
  tree,
}: Pick<FilePickerProps, "cwd" | "value" | "tree">) => {
  // The path for /data/ folder is absolute
  if (relativeFilePath.startsWith("/data/")) {
    return getFolderPath(relativeFilePath.replace(/^\/data\//, "/data:/"));
  }

  const absCwd = `/project-dir:/${cwd === "/" ? "" : cwd}`;

  // The rest is a relative path to pipelineCwd
  const projectFilePath = collapseDoubleDots(`${absCwd}${relativeFilePath}`);
  const isFile = !projectFilePath.endsWith("/");
  const directoryPath = isFile
    ? getFolderPath(projectFilePath)
    : projectFilePath;

  // Check if directoryPath exists.
  // If not, use pipelineCwd as fallback.
  return validatePathInTree(directoryPath, tree) ? directoryPath : absCwd;
};

const ProjectFilePicker: React.FC<{
  pipelineCwd: string | undefined;
  value: string;
  onChange: (value: string) => void;
  menuMaxWidth?: string;
}> = ({ onChange, pipelineCwd, value, menuMaxWidth }) => {
  const { projectUuid, pipelineUuid } = useCustomRoute();
  // ProjectFilePicker uses the same endpoint for fetching FileTree
  const { fileTrees, fetchFileTrees } = useFileManagerContext();

  const selectedFileExists = useCheckFileValidity(
    projectUuid,
    pipelineUuid,
    value
  );

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
          name: key === "/project-dir" ? "Project files" : key,
          // Adding trailing ":/" to mark it as a root folder (note that the "root" of this tree is virtural, only for UI rendering).
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
          icon={
            selectedFileExists ? (
              <CheckIcon color="success" />
            ) : (
              <WarningIcon color="warning" />
            )
          }
          helperText={
            selectedFileExists
              ? "File exists in the project directory."
              : "Warning: this file wasn't found in the project directory."
          }
          onChangeValue={onChange}
          menuMaxWidth={menuMaxWidth}
          onSelectMenuItem={onSelectMenuItem}
        />
      )}
    </>
  );
};

export default ProjectFilePicker;
