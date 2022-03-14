import { IconButton } from "@/components/common/IconButton";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DriveFolderUploadIcon from "@mui/icons-material/DriveFolderUpload";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import RefreshIcon from "@mui/icons-material/Refresh";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { styled } from "@mui/material";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { queryArgs } from "./common";

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
  const {
    state: { pipelineUuid, projectUuid },
  } = useProjectsContext();
  const uploadFileRef = React.useRef<HTMLInputElement>();
  const uploadFolderRef = React.useRef<HTMLInputElement>();

  const handleUploadFile = () => {
    let files = uploadFileRef.current.files;
    uploadFiles(files);
  };

  const handleUploadFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(e.target.files);
  };

  const createFolder = async () => {
    let folderName = window.prompt("Enter the desired folder name");

    if (!folderName) return;

    try {
      await fetcher(
        `${baseUrl}/create-dir?${queryArgs({
          path: `/${folderName}/`,
          root: rootFolder,
        })}`,
        { method: "POST" }
      );
      reload();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  return (
    <>
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
            onClick={() => {
              window.alert("Waiting for the endpoint");
            }}
          >
            <NoteAddIcon />
          </FileManagerActionButton>
          <FileManagerActionButton
            onClick={() => createFolder()}
            title="Create folder"
          >
            <CreateNewFolderIcon />
          </FileManagerActionButton>
          <FileManagerActionButton title="Refresh" onClick={() => reload()}>
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
