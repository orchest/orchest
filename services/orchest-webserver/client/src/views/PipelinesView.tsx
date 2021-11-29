import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import React from "react";

const PipelinesView: React.FC = () => {
  const { projectUuid } = useCustomRoute();

  useSendAnalyticEvent("view load", { name: siteMap.pipelines.path });

  return (
    <Layout>
      <ProjectBasedView projectUuid={projectUuid}>
        <PipelineList projectUuid={projectUuid} key={projectUuid} />
      </ProjectBasedView>
    </Layout>
  );
};

export default PipelinesView;
