import { FileManagementRoot } from "@/pipeline-view/common";
import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import Box, { BoxProps } from "@mui/material/Box";
import { SxProps, Theme } from "@mui/material/styles";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileWithPath, useDropzone } from "react-dropzone";

/**
 * this function determines if the given file is a file uploaded via useDropzone
 * if true, the file has a property "path"
 * @param file File | FileWithPath
 * @returns boolean
 */

export type FileWithValidPath = FileWithPath & { readonly path: string };

function isUploadedViaDropzone(
  file: File | FileWithPath
): file is FileWithValidPath {
  return hasValue((file as FileWithPath).path);
}

export const generateUploadFiles = ({
  projectUuid,
  root,
  path: targetFolderPath,
}: {
  projectUuid: string;
  root: FileManagementRoot;
  path: string;
}) => (files: File[] | FileList, onUploaded?: () => void) => {
  // ensure that we are handling File[] instead of FileList
  return Array.from(files).map(async (file: File | FileWithValidPath) => {
    // Derive folder to upload the file to if webkitRelativePath includes a slash
    // (means the file was uploaded as a folder through drag or folder file selection)
    const isUploadedAsFolder = isUploadedViaDropzone(file)
      ? /.+\/.+/.test(file.path)
      : file.webkitRelativePath !== undefined &&
        file.webkitRelativePath.includes("/");

    const path = !isUploadedAsFolder
      ? targetFolderPath
      : `${targetFolderPath}${(isUploadedViaDropzone(file)
          ? file.path
          : file.webkitRelativePath
        )
          .split("/")
          .slice(0, -1)
          .filter((value) => value.length > 0)
          .join("/")}/`;

    let formData = new FormData();
    formData.append("file", file);

    await fetcher(
      `${FILE_MANAGEMENT_ENDPOINT}/upload?${queryArgs({
        root,
        path,
        project_uuid: projectUuid,
      })}`,
      { method: "POST", body: formData }
    );

    if (onUploaded) onUploaded();
  });
};

export const defaultOverlaySx: SxProps<Theme> = {
  position: "absolute",
  width: "calc(100% - 4px)",
  height: "calc(100% - 4px)",
  margin: "2px",
  pointerEvents: "none",
  border: (theme) => `2px dotted ${theme.palette.primary.light}`,
};

export const DropZone: React.FC<
  BoxProps & {
    disabled?: boolean;
    uploadFiles: (files: File[] | FileList) => Promise<void>;
    overlayProps?: BoxProps;
    disableOverlay?: boolean;
    children: React.ReactNode | ((isDragActive: boolean) => React.ReactNode);
  }
> = ({
  children,
  disabled,
  uploadFiles,
  overlayProps,
  disableOverlay = false,
  ...props
}) => {
  // The built-in state `acceptedFiles` is persisted, and cannot be cleared.
  // while `onDropAccepted` is an one-off action
  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    onDropAccepted: (files: File[]) => {
      if (!disabled && files.length > 0) uploadFiles(files);
    },
  });

  return (
    <Box
      {...props}
      {...getRootProps({
        onClick: (event) => {
          event.stopPropagation();
        },
      })}
    >
      {!disableOverlay && isDragActive && (
        <Box sx={defaultOverlaySx} {...overlayProps} />
      )}
      <input {...getInputProps()} webkitdirectory="" directory="" />
      {children instanceof Function ? children(isDragActive) : children}
    </Box>
  );
};
