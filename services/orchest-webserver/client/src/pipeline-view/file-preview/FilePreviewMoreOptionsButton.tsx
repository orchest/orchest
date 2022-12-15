import { useFileApi } from "@/api/files/useFileApi";
import { useActiveStep } from "@/hooks/useActiveStep";
import { useConfirm } from "@/hooks/useConfirm";
import { useCustomRoute, useNavigate } from "@/hooks/useCustomRoute";
import { downloadFile, FileRoot } from "@/utils/file";
import { stepPathToProjectPath } from "@/utils/pipeline";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";
import IconButton from "@mui/material/IconButton";
import React from "react";
import { FileContextMenu } from "../components/FileContextMenu";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

export const FilePreviewMoreOptionsButton = () => {
  const [isOpened, setIsOpened] = React.useState(false);
  const deleteFile = useFileApi((api) => api.delete);
  const deleteWithConfirm = useConfirm(deleteFile, {
    title: "Delete file",
    content: "Are you sure you want to delete this file?",
  });
  const { projectUuid, filePath } = useCustomRoute();
  const step = useActiveStep();
  const { pipelineCwd } = usePipelineDataContext();
  const navigate = useNavigate();
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  const { root, path } = React.useMemo(() => {
    if (step && pipelineCwd) {
      return stepPathToProjectPath(step.file_path, pipelineCwd);
    } else {
      return { root: "/project-dir" as FileRoot, path: filePath };
    }
  }, [filePath, pipelineCwd, step]);

  const handleDownload = React.useCallback(() => {
    if (!projectUuid || !path) return;

    downloadFile({ projectUuid, root, path });
  }, [projectUuid, root, path]);

  const handleDelete = React.useCallback(() => {
    if (!projectUuid || !path) return;

    deleteWithConfirm(root, path).then(() => navigate({ route: "pipeline" }));
  }, [projectUuid, path, deleteWithConfirm, root, navigate]);

  if (!path) return null;

  return (
    <>
      <IconButton
        ref={buttonRef}
        title="More options"
        size="small"
        onClick={() => setIsOpened(true)}
      >
        <MoreHorizOutlined fontSize="small" />
      </IconButton>

      <FileContextMenu
        anchorEl={buttonRef.current}
        open={isOpened}
        root={root}
        path={path}
        showEdit={false}
        onClickDownload={handleDownload}
        onClickDelete={handleDelete}
        onClose={() => setIsOpened(false)}
      />
    </>
  );
};
