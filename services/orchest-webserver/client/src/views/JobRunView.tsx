import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import React from "react";
import { PipelineCanvasContextProvider } from "../pipeline-view/contexts/PipelineCanvasContext";
import { PipelineEditorContextProvider } from "../pipeline-view/contexts/PipelineEditorContext";
import { PipelineEditor } from "../pipeline-view/PipelineEditor";
import { siteMap } from "../Routes";

const PipelineView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.jobRun.path });

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
