import Box, { BoxProps } from "@mui/material/Box";
import { alpha, SxProps, Theme } from "@mui/material/styles";
import React from "react";
import { useDropzone } from "react-dropzone";

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

type DropZoneProps = BoxProps & {
  disabled?: boolean;
  uploadFiles: (files: File[] | FileList) => Promise<any> | any;
  overlayProps?: BoxProps;
  disableOverlay?: boolean;
  children: React.ReactNode | ((isDragActive: boolean) => React.ReactNode);
};

export const DropZone = React.forwardRef<HTMLDivElement, DropZoneProps>(
  (
    {
      children,
      disabled,
      uploadFiles,
      overlayProps,
      disableOverlay = false,
      ...props
    },
    ref
  ) => {
    // The built-in state `acceptedFiles` is persisted, and cannot be cleared.
    // while `onDropAccepted` is an one-off action
    const { getInputProps, getRootProps, isDragActive } = useDropzone({
      onDropAccepted: (files: File[]) => {
        if (!disabled && files.length > 0) uploadFiles(files);
      },
    });

    return (
      <Box
        ref={ref}
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
  }
);
