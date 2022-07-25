import { DropZone } from "@/components/DropZone";
import {
  ElementSize,
  ResizableContainer,
  ResizeHeightBar,
} from "@/components/ResizableContainer";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isNumber } from "@/utils/webserver-utils";
import React from "react";
import { FILE_MANAGER_ROOT_CLASS } from "./common";

const MIN_PANEL_HEIGHT = 100;

type FileManagerContainerProps = {
  uploadFiles: (files: File[] | FileList) => Promise<void>;
  children: React.ReactNode;
};

export const FileManagerContainer = React.forwardRef<
  HTMLDivElement,
  FileManagerContainerProps
>(function FileManagerContainerComponent({ children, uploadFiles }, ref) {
  const localRef = React.useRef<HTMLDivElement>();

  const { pipelineUuid } = useCustomRoute();
  const disabled = !pipelineUuid;

  const [storedHeight, , saveToLocalstorage] = useLocalStorage(
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
        saveToLocalstorage(Number(height));
      }
    },
    [disabled, saveToLocalstorage]
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
      sx={{ position: "relative" }}
      onResized={saveHeight}
    >
      {({ size, resizeHeight }) => {
        return (
          <DropZone
            uploadFiles={uploadFiles}
            ref={(node: HTMLDivElement) => {
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
