import EnvironmentList from "@/components/EnvironmentList";
import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

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
