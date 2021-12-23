import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";

const ManageUsersView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.manageUsers.path });

  return (
    <Layout disablePadding fullHeight>
      <div className="view-page no-padding manage-users fullheight">
        <iframe
          className="borderless fullsize"
          src="/login/admin"
          data-test-id="auth-admin-iframe"
        />
      </div>
    </Layout>
  );
};

export default ManageUsersView;
