import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import React from "react";
import { siteMap } from "../Routes";
import { PipelineEditor } from "./PipelineEditor";
import { PipelineEditorContextProvider } from "./PipelineEditorContext";

const PipelineView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.pipeline.path });

  return (
    <Layout disablePadding>
      <PipelineEditorContextProvider>
        <PipelineEditor />
      </PipelineEditorContextProvider>
    </Layout>
  );
};

export default PipelineView;
