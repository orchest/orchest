import React from "react";

import { OrchestSessionsConsumer } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import PipelineList from "@/components/PipelineList";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";

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
