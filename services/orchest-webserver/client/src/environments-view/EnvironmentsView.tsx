import { Layout } from "@/components/Layout";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { MainSidePanel } from "@/pipeline-view/MainSidePanel";
import { siteMap } from "@/routingConfig";
import Stack from "@mui/material/Stack";
import React from "react";
import { EnvironmentMenuList } from "./EnvironmentMenuList";

const EnvironmentsView: React.FC = () => {
  const { projectUuid } = useCustomRoute();
  useSendAnalyticEvent("view:loaded", { name: siteMap.environments.path });

  return (
    <Layout disablePadding>
      <Stack direction="row" sx={{ height: "100%", width: "100%" }}>
        <MainSidePanel>
          <EnvironmentMenuList />
        </MainSidePanel>
        {/* <EnvironmentList projectUuid={projectUuid} /> */}
      </Stack>
    </Layout>
  );
};

export default EnvironmentsView;
