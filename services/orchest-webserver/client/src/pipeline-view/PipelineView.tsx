import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import React from "react";
import { siteMap } from "../Routes";
import { PipelineCanvasContextProvider } from "./contexts/PipelineCanvasContext";
import { PipelineEditorContextProvider } from "./contexts/PipelineEditorContext";
import { PipelineEditor } from "./PipelineEditor";

const PipelineView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.pipeline.path });

  return (
    <Layout disablePadding>
      <PipelineEditorContextProvider>
        <PipelineCanvasContextProvider>
          <PipelineEditor />
        </PipelineCanvasContextProvider>
      </PipelineEditorContextProvider>
    </Layout>
  );
};

export default PipelineView;
