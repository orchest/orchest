import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DriveFolderUploadIcon from "@mui/icons-material/DriveFolderUpload";
import RefreshIcon from "@mui/icons-material/Refresh";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { FILE_MANAGER_ENDPOINT } from "./common";

function ActionBar({
  uploadFiles,
  reload,
  rootFolder,
  setExpanded,
}: {
  rootFolder: string;
  uploadFiles: (files: File[] | FileList) => void;
  reload: () => void;
  setExpanded: (items: string[]) => void;
}) {
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
        `${FILE_MANAGER_ENDPOINT}/create-dir?path=/${window.encodeURIComponent(
          folderName
        )}/&root=${window.encodeURIComponent(rootFolder)}`,
        { method: "POST" }
      );
      reload();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const iconButtonStyles = {
    svg: {
      width: 20,
      height: 20,
    },
    padding: "4px",
  };

  return (
    <Box
      sx={{
        display: "flex",
        padding: "0.25em",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "right",
      }}
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
        <IconButton
          sx={iconButtonStyles}
          onClick={() => {
            uploadFileRef.current.click();
          }}
        >
          <UploadFileIcon />
        </IconButton>
        <IconButton
          sx={iconButtonStyles}
          onClick={() => {
            uploadFolderRef.current?.click();
          }}
        >
          <DriveFolderUploadIcon />
        </IconButton>
        <IconButton sx={iconButtonStyles} onClick={() => createFolder()}>
          <CreateNewFolderIcon />
        </IconButton>
        <IconButton sx={iconButtonStyles} onClick={() => reload()}>
          <RefreshIcon />
        </IconButton>
        <IconButton sx={iconButtonStyles} onClick={() => setExpanded([])}>
          <UnfoldLessIcon />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ActionBar;
