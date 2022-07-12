import { IconButton } from "@/components/common/IconButton";
import { UploadFilesForm } from "@/components/UploadFilesForm";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import NoteAddOutlinedIcon from "@mui/icons-material/NoteAddOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import React from "react";
import { FileManagementRoot } from "../common";
import { useCreateStep } from "../hooks/useCreateStep";
import { CreatedFile, CreateFileDialog } from "./CreateFileDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { useFileManagerContext } from "./FileManagerContext";
import { useFileManagerLocalContext } from "./FileManagerLocalContext";

const FileManagerActionButton = styled(IconButton)(({ theme }) => ({
  svg: { width: 20, height: 20 },
  padding: theme.spacing(0.5),
}));

type OpenDialog = "file" | "folder";

type ActionBarProps = {
  rootFolder: FileManagementRoot;
  uploadFiles: (files: File[] | FileList) => void;
  setExpanded: (items: string[]) => void;
};

export function ActionBar({
  uploadFiles,
  rootFolder,
  setExpanded,
}: ActionBarProps) {
  const [openDialog, setOpenDialog] = React.useState<OpenDialog | null>(null);
  const { setSelectedFiles } = useFileManagerContext();
  const { reload } = useFileManagerLocalContext();
  const {
    state: { pipelineIsReadOnly, pipeline },
  } = useProjectsContext();
  const createStep = useCreateStep();

  const onFileCreated = React.useCallback(
    (file: CreatedFile) => {
      setSelectedFiles([file.fullPath]);
      reload();

      if (file.shouldCreateStep) {
        createStep(file.projectPath);
      }
    },
    [createStep, setSelectedFiles, reload]
  );

  const closeDialog = React.useCallback(() => setOpenDialog(null), []);

  return (
    <>
      <CreateFileDialog
        isOpen={!pipelineIsReadOnly && openDialog === "file"}
        canCreateStep={Boolean(pipeline)}
        root={rootFolder}
        onClose={closeDialog}
        onSuccess={onFileCreated}
      />
      <CreateFolderDialog
        isOpen={!pipelineIsReadOnly && openDialog === "folder"}
        onClose={closeDialog}
        root={rootFolder}
        onSuccess={reload}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        spacing={1.5}
        sx={{ padding: (theme) => theme.spacing(0.5, 1.5, 1) }}
      >
        {!pipelineIsReadOnly && (
          <>
            <FileManagerActionButton
              title="Create file"
              onClick={() => setOpenDialog("file")}
            >
              <NoteAddOutlinedIcon />
            </FileManagerActionButton>
            <FileManagerActionButton
              onClick={() => setOpenDialog("folder")}
              title="Create folder"
            >
              <CreateNewFolderOutlinedIcon />
            </FileManagerActionButton>
            <UploadFilesForm multiple upload={uploadFiles}>
              {(onClick) => (
                <FileManagerActionButton onClick={onClick} title="Upload file">
                  <UploadFileOutlinedIcon />
                </FileManagerActionButton>
              )}
            </UploadFilesForm>
            <UploadFilesForm folder upload={uploadFiles}>
              {(onClick) => (
                <FileManagerActionButton
                  onClick={onClick}
                  title="Upload folder"
                >
                  <DriveFolderUploadOutlinedIcon />
                </FileManagerActionButton>
              )}
            </UploadFilesForm>
          </>
        )}
        <FileManagerActionButton title="Refresh" onClick={reload}>
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
