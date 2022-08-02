import { DropZone } from "@/components/DropZone";
import { ResizablePane } from "@/components/ResizablePane";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { setRefs } from "@/utils/refs";
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

  const [storedHeight, , saveToLocalStorage] = useLocalStorage(
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
    (height: number) => {
      if (!disabled) saveToLocalStorage(height);
    },
    [disabled, saveToLocalStorage]
  );

  React.useEffect(() => {
    if (disabled) return;
    window.addEventListener("resize", updateMaxHeight);
    return () => {
      window.removeEventListener("resize", updateMaxHeight);
    };
  }, [disabled, updateMaxHeight]);

  return (
    <ResizablePane
      direction="vertical"
      anchor="top"
      onResized={saveHeight}
      initialSize={initialHeight}
      sx={{
        position: "relative",
        minHeight: MIN_PANEL_HEIGHT,
        maxHeight,
        borderBottom: (theme) => `1px solid ${theme.borderColor}`,
      }}
    >
      <DropZone
        uploadFiles={uploadFiles}
        ref={setRefs(localRef, ref)}
        sx={{
          display: "flex",
          flexDirection: "column",
        }}
        className={FILE_MANAGER_ROOT_CLASS}
        style={{
          height: "100%",
          overflowY: "auto",
        }}
      >
        {children}
      </DropZone>
    </ResizablePane>
  );
});
