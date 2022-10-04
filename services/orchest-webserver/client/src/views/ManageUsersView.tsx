import { BackToOrchestSettingsButton } from "@/components/BackToOrchestSettingsButton";
import { Layout } from "@/components/layout/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import Box from "@mui/material/Box";
import React from "react";

const ManageUsersView: React.FC = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.manageUsers.path });

  return (
    <Layout>
      <BackToOrchestSettingsButton />
      <Box
        className="view-page no-padding manage-users fullheight"
        sx={{ marginTop: (theme) => theme.spacing(2) }}
      >
        <iframe
          className="borderless fullsize"
          src="/login/admin"
          data-test-id="auth-admin-iframe"
        />
      </Box>
    </Layout>
  );
};

export default ManageUsersView;
