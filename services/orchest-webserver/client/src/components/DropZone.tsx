import { FileManagementRoot } from "@/pipeline-view/common";
import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import { alpha } from "@mui/material";
import Box, { BoxProps } from "@mui/material/Box";
import { SxProps, Theme } from "@mui/material/styles";
import { fetcher, Fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { FileWithPath, useDropzone } from "react-dropzone";

export type FileWithValidPath = FileWithPath & { readonly path: string };

/**
 * this function determines if the given file is a file uploaded via useDropzone
 * if true, the file has a property "path"
 * @param file {File | FileWithPath}
 * @returns {boolean}
 */
export function isUploadedViaDropzone(
  file: File | FileWithPath
): file is FileWithValidPath {
  return hasValue((file as FileWithPath).path);
}

export const generateUploadFiles = ({
  projectUuid,
  root,
  path: targetFolderPath,
  isProjectUpload,
  cancelableFetch,
}: {
  projectUuid?: string;
  root: FileManagementRoot;
  path: string;
  isProjectUpload?: boolean;
  cancelableFetch?: Fetcher<void>;
}) => (
  files: File[] | FileList,
  onUploaded?: (completedCount: number, totalCount: number) => void
) => {
  // ensure that we are handling File[] instead of FileList
  const fileArray = Array.from(files);
  let completedCount = 0;
  return fileArray.map(async (file: File | FileWithValidPath) => {
    // Derive folder to upload the file to if webkitRelativePath includes a slash
    // (means the file was uploaded as a folder through drag or folder file selection)
    const isUploadedAsFolder = isUploadedViaDropzone(file)
      ? /.+\/.+/.test(file.path)
      : file.webkitRelativePath !== undefined &&
        file.webkitRelativePath.includes("/");

    let path = !isUploadedAsFolder
      ? targetFolderPath
      : `${targetFolderPath}${(isUploadedViaDropzone(file)
          ? file.path
          : file.webkitRelativePath
        )
          .split("/")
          .slice(0, -1)
          .filter((value) => value.length > 0)
          // Do not nest the project directory content.
          .slice(isProjectUpload ? 1 : 0)
          .join("/")}`;

    if (isUploadedAsFolder && !path.endsWith("/")) {
      path = path + "/";
    }

    let formData = new FormData();
    formData.append("file", file);

    const customFetch = cancelableFetch || fetcher;

    let queryArgsContent: {
      root: FileManagementRoot;
      path: string;
      project_uuid?: string;
    } = {
      root,
      path,
    };

    if (projectUuid !== undefined) {
      queryArgsContent.project_uuid = projectUuid;
    }
    await customFetch(
      `${FILE_MANAGEMENT_ENDPOINT}/upload?${queryArgs(queryArgsContent)}`,
      { method: "POST", body: formData }
    );

    completedCount += 1;

    if (onUploaded) onUploaded(completedCount, fileArray.length);
  });
};

export const defaultOverlaySx: SxProps<Theme> = {
  position: "absolute",
  width: (theme) => `calc(100% - ${theme.spacing(0.5)})`,
  height: (theme) => `calc(100% - ${theme.spacing(1)})`,
  margin: (theme) => theme.spacing(0.25),
  pointerEvents: "none",
  border: (theme) => `2px solid ${theme.palette.primary.main}`,
  backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.2),
  zIndex: 3,
};

export const DropZone: React.FC<
  BoxProps & {
    disabled?: boolean;
    uploadFiles: (files: File[] | FileList) => Promise<any> | any;
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
