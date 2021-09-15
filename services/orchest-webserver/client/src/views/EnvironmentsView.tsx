import React from "react";

import { Layout } from "@/components/Layout";
import EnvironmentList from "@/components/EnvironmentList";
import ProjectBasedView from "@/components/ProjectBasedView";

import { useCustomRoute } from "@/hooks/useCustomRoute";

const EnvironmentsView: React.FC = () => {
  const { projectUuid } = useCustomRoute();

  return (
    <Layout>
      <ProjectBasedView projectUuid={projectUuid}>
        <EnvironmentList projectUuid={projectUuid} />
      </ProjectBasedView>
    </Layout>
  );
};

export default EnvironmentsView;
