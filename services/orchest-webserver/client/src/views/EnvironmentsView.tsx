import EnvironmentList from "@/components/EnvironmentList";
import { Layout } from "@/components/Layout";
import ProjectBasedView from "@/components/ProjectBasedView";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";

const EnvironmentsView: React.FC = () => {
  const { projectUuid } = useCustomRoute();
  useSendAnalyticEvent("view load", { name: siteMap.environments.path });

  return (
    <Layout>
      <ProjectBasedView>
        <EnvironmentList projectUuid={projectUuid} />
      </ProjectBasedView>
    </Layout>
  );
};

export default EnvironmentsView;
