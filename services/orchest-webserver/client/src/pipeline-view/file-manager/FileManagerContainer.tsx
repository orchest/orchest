import {
  ElementSize,
  ResizableContainer,
  ResizeHeightBar,
} from "@/components/ResizableContainer";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import Box from "@mui/material/Box";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { useDropzone } from "react-dropzone";
import { FILE_MANAGER_ROOT_CLASS } from "./common";

export const FileManagerContainer = React.forwardRef<
  typeof Stack,
  StackProps & {
    uploadFiles: (files: File[] | FileList) => Promise<void>;
  }
>(function FileManagerContainerComponent({ children, uploadFiles }, ref) {
  const localRef = React.useRef<typeof Stack>(null);

  const {
    acceptedFiles,
    getInputProps,
    getRootProps,
    isDragActive,
  } = useDropzone();

  React.useEffect(() => {
    if (acceptedFiles.length > 0) uploadFiles(acceptedFiles);
  }, [uploadFiles, acceptedFiles]);

  const [storedHeight, setStoredHeight] = useLocalStorage(
    "pipelineEditor.fileManagerHeight",
    400
  );

  const saveHeight = React.useCallback(
    ({ height }: ElementSize) => {
      if (!isNaN(Number(height))) {
        setStoredHeight(Number(height));
      }
    },
    [setStoredHeight]
  );

  return (
    <ResizableContainer
      initialHeight={storedHeight}
      minHeight={100}
      maxHeight={window.innerHeight - 100}
      sx={{
        position: "relative",
        backgroundColor: (theme) => theme.palette.background.paper,
      }}
      onResized={saveHeight}
    >
      {({ size, resizeHeight }) => {
        return (
          <Stack
            {...getRootProps({
              onClick: (event) => {
                event.stopPropagation();
              },
            })}
            ref={(node: typeof Stack) => {
              // in order to manipulate a forwarded ref, we need to create a local ref to capture it
              localRef.current = node;
              if (typeof ref === "function") {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            className={FILE_MANAGER_ROOT_CLASS}
            style={{ maxHeight: size.height, overflowY: "auto" }}
          >
            {isDragActive && (
              <Box
                sx={{
                  position: "absolute",
                  width: "calc(100% - 4px)",
                  height: "calc(100% - 4px)",
                  margin: "2px",
                  pointerEvents: "none",
                  border: (theme) =>
                    `2px dotted ${theme.palette.primary.light}`,
                }}
              />
            )}
            <input {...getInputProps()} webkitdirectory="" directory="" />
            {children}
            <ResizeHeightBar
              resizeHeight={resizeHeight}
              sx={{ borderTop: (theme) => `1px solid ${theme.borderColor}` }}
            />
          </Stack>
        );
      }}
    </ResizableContainer>
  );
});
