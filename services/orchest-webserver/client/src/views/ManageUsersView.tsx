import * as React from "react";
import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";

const ManageUsersView: React.FC<TViewProps> = () => (
  <Layout>
    <div className="view-page no-padding manage-users">
      <iframe
        className="borderless fullsize"
        src="/login/admin"
        data-test-id="auth-admin-iframe"
      />
    </div>
  </Layout>
);

export default ManageUsersView;
