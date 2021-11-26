import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

const PipelinesView: React.FC = () => {
  const { projectUuid } = useCustomRoute();
  return (
    <Layout>
      <ProjectBasedView projectUuid={projectUuid}>
        <PipelineList projectUuid={projectUuid} key={projectUuid} />
      </ProjectBasedView>
    </Layout>
  );
};

export default PipelinesView;
