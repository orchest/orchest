import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getOffset } from "@/utils/jquery-replacement";
import Box from "@mui/material/Box";
import Stack, { StackProps } from "@mui/material/Stack";
import React from "react";
import { useDropzone } from "react-dropzone";
import { ResizeBar } from "../components/ResizeBar";
import { useResizeWidth } from "../hooks/useResizeWidth";
import { FILE_MANAGER_ROOT_CLASS } from "./common";

const DEFAULT_FILE_MANAGER_WIDTH = 300;
const MIN_FILE_MANAGER_WIDTH = 180;

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

  const [storedPanelWidth, setStoredPanelWidth] = useLocalStorage(
    "pipelineFileManager.panelWidth",
    DEFAULT_FILE_MANAGER_WIDTH
  );

  const [panelWidth, setPanelWidth] = React.useState(storedPanelWidth);

  const onDragging = React.useCallback(
    (positionX: React.MutableRefObject<{ prev: number; delta: number }>) => {
      const { left } = getOffset((localRef.current as unknown) as HTMLElement);
      // Offset 5 pixels to get cursor above drag handler (to show appropriate mouse cursor)
      let newPanelWidth = Math.max(
        MIN_FILE_MANAGER_WIDTH,
        positionX.current.prev + 5 - left
      );

      setPanelWidth(Math.min(newPanelWidth, window.innerWidth - 100));
    },
    []
  );

  const onStopDragging = React.useCallback(() => {
    setPanelWidth((panelWidth) => {
      setStoredPanelWidth(panelWidth);
      return panelWidth;
    });
  }, [setStoredPanelWidth]);

  const startDragging = useResizeWidth(onDragging, onStopDragging);

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
      style={{ minWidth: `${panelWidth}px`, maxWidth: `${panelWidth}px` }}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        backgroundColor: (theme) => theme.palette.background.paper,
        borderRight: (theme) => `1px solid ${theme.borderColor}`,
      }}
    >
      {isDragActive && (
        <Box
          sx={{
            position: "absolute",
            width: "calc(100% - 4px)",
            height: "calc(100% - 4px)",
            margin: "2px",
            pointerEvents: "none",
            border: (theme) => `2px dotted ${theme.palette.primary.light}`,
          }}
        />
      )}
      <input {...getInputProps()} webkitdirectory="" directory="" />
      {children}
      <ResizeBar onMouseDown={startDragging} sx={{ right: 0 }} />
    </Stack>
  );
});
