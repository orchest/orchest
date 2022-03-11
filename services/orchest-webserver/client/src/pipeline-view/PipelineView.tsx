import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import Stack from "@mui/material/Stack";
import React from "react";
import { siteMap } from "../Routes";
import { PipelineCanvasContextProvider } from "./contexts/PipelineCanvasContext";
import { PipelineEditorContextProvider } from "./contexts/PipelineEditorContext";
import { FileManager } from "./file-manager/FileManager";
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
        <PipelineCanvasContextProvider>
          <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
            <FileManager
              onDropOutside={() => {
                console.log("DEV onDropOutside");
              }}
              onEdit={() => {
                console.log("DEV onEdit");
              }}
              onOpen={() => {
                console.log("DEV onOpen");
              }}
              onSelect={() => {
                console.log("DEV onSelect");
              }}
              onView={() => {
                console.log("DEV onView");
              }}
            />
            <PipelineEditor />
          </Stack>
        </PipelineCanvasContextProvider>
      </PipelineEditorContextProvider>
    </Layout>
  );
};

export default PipelineView;
