import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView from "@/components/ProjectBasedView";
import { OrchestSessionsConsumer } from "@/hooks/orchest";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

const PipelinesView: React.FC = () => {
  const { projectUuid } = useCustomRoute();
  return (
    <OrchestSessionsConsumer>
      <Layout>
        <ProjectBasedView projectUuid={projectUuid}>
          <PipelineList projectUuid={projectUuid} key={projectUuid} />
        </ProjectBasedView>
      </Layout>
    </OrchestSessionsConsumer>
  );
};

export default PipelinesView;
