import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import { SettingsViewLayout } from "@/settings-view/SettingsViewLayout";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import React from "react";

const ManageUsersView: React.FC = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.manageUsers.path });

  return (
    <SettingsViewLayout
      header={<Typography variant="h5">Manage users</Typography>}
      fixedWidth={false}
    >
      <Box
        sx={{
          marginTop: (theme) => theme.spacing(2),
          width: "100%",
          height: "100%",
        }}
      >
        <iframe
          className="borderless fullsize"
          src="/login/admin"
          data-test-id="auth-admin-iframe"
        />
      </Box>
    </SettingsViewLayout>
  );
};

export default ManageUsersView;
