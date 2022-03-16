import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import Stack from "@mui/material/Stack";
import React from "react";
import { siteMap } from "../Routes";
import { PipelineCanvasContextProvider } from "./contexts/PipelineCanvasContext";
import { PipelineEditorContextProvider } from "./contexts/PipelineEditorContext";
import { FileManagerContextProvider } from "./file-manager/FileManagerContext";
import { ProjectFileManager } from "./file-manager/ProjectFileManager";
import { PipelineEditor } from "./PipelineEditor";

const PipelineView = () => {
  useSendAnalyticEvent("view load", { name: siteMap.pipeline.path });
  const { setIsDrawerOpen } = useAppContext();

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsDrawerOpen(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [setIsDrawerOpen]);

  return (
    <Layout disablePadding>
      <PipelineEditorContextProvider>
        <FileManagerContextProvider>
          <PipelineCanvasContextProvider>
            <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
              <ProjectFileManager />
              <PipelineEditor />
            </Stack>
          </PipelineCanvasContextProvider>
        </FileManagerContextProvider>
      </PipelineEditorContextProvider>
    </Layout>
  );
};

export default PipelineView;
