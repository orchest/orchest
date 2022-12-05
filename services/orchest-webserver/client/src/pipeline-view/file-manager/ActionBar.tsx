import { useFileApi } from "@/api/files/useFileApi";
import { IconButton } from "@/components/common/IconButton";
import { UploadFilesForm } from "@/components/UploadFilesForm";
import { combinePath, FileRoot } from "@/utils/file";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import NoteAddOutlinedIcon from "@mui/icons-material/NoteAddOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { useCreateStep } from "../hooks/useCreateStep";
import { useFileManagerState } from "../hooks/useFileManagerState";
import { CreatedFile, CreateFileDialog } from "./CreateFileDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";

const FileManagerActionButton = styled(IconButton)(({ theme }) => ({
  svg: { width: 20, height: 20 },
  padding: theme.spacing(0.5),
}));

type OpenDialog = "file" | "folder";

type ActionBarProps = {
  root: FileRoot;
  cwd: string;
  uploadFiles: (files: File[] | FileList) => void;
  onCreated: (root: FileRoot, path: string) => void;
};

export function ActionBar({
  root,
  cwd,
  uploadFiles,
  onCreated,
}: ActionBarProps) {
  const reload = useFileApi((api) => api.refresh);
  const [openDialog, setOpenDialog] = React.useState<OpenDialog | null>(null);
  const { isReadOnly, pipeline } = usePipelineDataContext();
  const setExpanded = useFileManagerState((state) => state.setExpanded);

  const createStep = useCreateStep();

  const onFileCreated = React.useCallback(
    ({ root, path, shouldCreateStep }: CreatedFile) => {
      if (shouldCreateStep) {
        const combinedPath = combinePath({ root, path });

        createStep(combinedPath);
        onCreated(root, path);
      }
    },
    [createStep, onCreated]
  );

  const closeDialog = React.useCallback(() => setOpenDialog(null), []);

  return (
    <>
      <CreateFileDialog
        root={root}
        cwd={cwd}
        isOpen={!isReadOnly && openDialog === "file"}
        canCreateStep={Boolean(pipeline)}
        onClose={closeDialog}
        onSuccess={onFileCreated}
      />
      <CreateFolderDialog
        root={root}
        cwd={cwd}
        isOpen={!isReadOnly && openDialog === "folder"}
        onClose={closeDialog}
        onSuccess={(path) => onCreated(root, path)}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-evenly"
        spacing={1.5}
        sx={{ padding: (theme) => theme.spacing(0.5, 1.5, 1) }}
      >
        <FileManagerActionButton
          disabled={isReadOnly}
          title="Create file"
          onClick={() => setOpenDialog("file")}
        >
          <NoteAddOutlinedIcon />
        </FileManagerActionButton>
        <FileManagerActionButton
          disabled={isReadOnly}
          onClick={() => setOpenDialog("folder")}
          title="Create folder"
        >
          <CreateNewFolderOutlinedIcon />
        </FileManagerActionButton>
        <UploadFilesForm multiple upload={uploadFiles}>
          {(onClick) => (
            <FileManagerActionButton
              disabled={isReadOnly}
              onClick={onClick}
              title="Upload file"
            >
              <UploadFileOutlinedIcon />
            </FileManagerActionButton>
          )}
        </UploadFilesForm>
        <UploadFilesForm folder upload={uploadFiles}>
          {(onClick) => (
            <FileManagerActionButton
              disabled={isReadOnly}
              onClick={onClick}
              title="Upload folder"
            >
              <DriveFolderUploadOutlinedIcon />
            </FileManagerActionButton>
          )}
        </UploadFilesForm>
        <FileManagerActionButton title="Refresh" onClick={() => reload()}>
          <RefreshOutlinedIcon />
        </FileManagerActionButton>
        <FileManagerActionButton
          title="Collapse all"
          onClick={() => setExpanded([])}
        >
          <UnfoldLessIcon />
        </FileManagerActionButton>
      </Stack>
    </>
  );
}
