import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import React from "react";
import { siteMap } from "../Routes";
import { PipelineCanvasContextProvider } from "./contexts/PipelineCanvasContext";
import { PipelineEditorContextProvider } from "./contexts/PipelineEditorContext";
import { FileManager } from "./file-manager/FileManager";
import { PipelineEditor } from "./PipelineEditor";

const PipelineView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.pipeline.path });

  return (
    <Layout disablePadding>
      <PipelineEditorContextProvider>
        <PipelineCanvasContextProvider>
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
        </PipelineCanvasContextProvider>
      </PipelineEditorContextProvider>
    </Layout>
  );
};

export default PipelineView;
