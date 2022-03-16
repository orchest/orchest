import { IconButton } from "@/components/common/IconButton";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DriveFolderUploadIcon from "@mui/icons-material/DriveFolderUpload";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import RefreshIcon from "@mui/icons-material/Refresh";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { styled } from "@mui/material";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import { CreateFileDialog } from "./CreateFileDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { useFileManagerContext } from "./FileManagerContext";

const FileManagerActionButton = styled(IconButton)(({ theme }) => ({
  svg: {
    width: 20,
    height: 20,
  },
  padding: theme.spacing(0.5),
}));

export function ActionBar({
  baseUrl,
  uploadFiles,
  reload,
  rootFolder,
  setExpanded,
}: {
  baseUrl: string;
  rootFolder: string;
  uploadFiles: (files: File[] | FileList) => void;
  reload: () => void;
  setExpanded: (items: string[]) => void;
}) {
  const { projectUuid } = useCustomRoute();
  const { setSelectedFiles } = useFileManagerContext();

  const [isCreateFileDialogOpen, setIsCreateFileDialogOpen] = React.useState(
    false
  );
  const openCreateFileDialog = () => setIsCreateFileDialogOpen(true);
  const closeCreateFileDialog = () => setIsCreateFileDialogOpen(false);

  const [
    isCreateFolderDialogOpen,
    setIsCreateFolderDialogOpen,
  ] = React.useState(false);
  const openCreateFolderDialog = () => setIsCreateFolderDialogOpen(true);
  const closeCreateFolderDialog = () => setIsCreateFolderDialogOpen(false);

  const uploadFileRef = React.useRef<HTMLInputElement>();
  const uploadFolderRef = React.useRef<HTMLInputElement>();

  const handleUploadFile = () => {
    let files = uploadFileRef.current.files;
    uploadFiles(files);
  };

  const handleUploadFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(e.target.files);
  };

  return (
    <>
      <CreateFileDialog
        isOpen={isCreateFileDialogOpen}
        onClose={closeCreateFileDialog}
        onSuccess={(fullFilePath: string) => {
          setSelectedFiles([fullFilePath]);
          reload();
        }}
        projectUuid={projectUuid}
      />
      <CreateFolderDialog
        baseUrl={baseUrl}
        isOpen={isCreateFolderDialogOpen}
        onClose={closeCreateFolderDialog}
        root={rootFolder}
        onSuccess={() => {
          reload();
        }}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{ padding: (theme) => theme.spacing(0.5) }}
      >
        <Box>
          <form style={{ display: "none" }}>
            <input
              type="file"
              multiple
              onChange={handleUploadFile}
              ref={uploadFileRef}
            />
          </form>
          <form style={{ display: "none" }}>
            <input
              type="file"
              webkitdirectory=""
              directory=""
              onChange={handleUploadFolder}
              ref={uploadFolderRef}
            />
          </form>
          <FileManagerActionButton
            onClick={() => {
              uploadFileRef.current.click();
            }}
            title="Upload file"
          >
            <UploadFileIcon />
          </FileManagerActionButton>
          <FileManagerActionButton
            onClick={() => {
              uploadFolderRef.current?.click();
            }}
            title="Upload folder"
          >
            <DriveFolderUploadIcon />
          </FileManagerActionButton>
          <FileManagerActionButton
            title="Create file"
            onClick={openCreateFileDialog}
          >
            <NoteAddIcon />
          </FileManagerActionButton>
          <FileManagerActionButton
            onClick={openCreateFolderDialog}
            title="Create folder"
          >
            <CreateNewFolderIcon />
          </FileManagerActionButton>
          <FileManagerActionButton title="Refresh" onClick={reload}>
            <RefreshIcon />
          </FileManagerActionButton>
          <FileManagerActionButton
            title="Collapse all"
            onClick={() => setExpanded([])}
          >
            <UnfoldLessIcon />
          </FileManagerActionButton>
        </Box>
      </Stack>
    </>
  );
}
