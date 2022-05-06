import { DropZone } from "@/components/DropZone";
import {
  ElementSize,
  ResizableContainer,
  ResizeHeightBar,
} from "@/components/ResizableContainer";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import Box, { BoxProps } from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import { FILE_MANAGER_ROOT_CLASS } from "./common";

const MIN_PANEL_HEIGHT = 100;

export const FileManagerContainer = React.forwardRef<
  typeof Box,
  BoxProps & {
    uploadFiles: (files: File[] | FileList) => Promise<void>;
  }
>(function FileManagerContainerComponent({ children, uploadFiles, sx }, ref) {
  const localRef = React.useRef<typeof Stack | null>(null);

  const { pipelineUuid } = useCustomRoute();
  const disabled = !pipelineUuid;

  const [storedHeight, setStoredHeight] = useLocalStorage(
    "pipelineEditor.fileManagerHeight",
    (window.innerHeight * 2) / 3
  );

  const [maxHeight, setMaxHeight] = React.useState(
    window.innerHeight - MIN_PANEL_HEIGHT
  );

  const updateMaxHeight = React.useCallback(() => {
    setMaxHeight(window.innerHeight - MIN_PANEL_HEIGHT);
  }, []);

  const initialHeight = React.useMemo(() => {
    return Math.min(storedHeight, maxHeight);
  }, [storedHeight, maxHeight]);

  const saveHeight = React.useCallback(
    ({ height }: ElementSize) => {
      if (!disabled && isNumber(height)) {
        setStoredHeight(Number(height));
      }
    },
    [disabled, setStoredHeight]
  );

  React.useEffect(() => {
    if (disabled) return;
    window.addEventListener("resize", updateMaxHeight);
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
    };
  }, [disabled, updateMaxHeight]);

  return (
    <ResizableContainer
      initialHeight={initialHeight}
      minHeight={MIN_PANEL_HEIGHT}
      maxHeight={maxHeight}
      sx={{
        position: "relative",
        backgroundColor: (theme) => theme.palette.background.paper,
        ...sx,
      }}
      onResized={saveHeight}
    >
      {({ size, resizeHeight }) => {
        return (
          <DropZone
            uploadFiles={uploadFiles}
            ref={(node: typeof Stack) => {
              // in order to manipulate a forwarded ref, we need to create a local ref to capture it
              localRef.current = node;
              if (typeof ref === "function") {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            sx={{
              display: "flex",
              flexDirection: "column",
            }}
            className={FILE_MANAGER_ROOT_CLASS}
            style={{
              height: size.height,
              overflowY: "auto",
            }}
          >
            {children}
            <ResizeHeightBar
              resizeHeight={resizeHeight}
              sx={{ borderTop: (theme) => `1px solid ${theme.borderColor}` }}
            />
          </DropZone>
        );
      }}
    </ResizableContainer>
  );
});
