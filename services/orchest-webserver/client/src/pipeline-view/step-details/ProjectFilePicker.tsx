import { useCheckFileValidity } from "@/hooks/useCheckFileValidity";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { FileTree } from "@/types";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import React from "react";
import { useFileManagerContext } from "../file-manager/FileManagerContext";
import FilePicker from "./FilePicker";

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
      root: true,
      children: Object.entries(fileTrees).map(([key, rootTree]) => {
        return {
          ...rootTree,
          root: false,
          name: key === "/project-dir" ? "Project files" : key,
          path: `${key}:/`, // Adding trailing ":/" to mark it as the root folder.
          depth: 0,
        };
      }),
    };
  }, [fileTrees]);

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
      {tree && pipelineCwd && (
        <FilePicker
          tree={tree}
          cwd={pipelineCwd}
          value={value}
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
