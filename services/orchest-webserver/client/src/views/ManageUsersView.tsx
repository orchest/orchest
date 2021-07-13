import * as React from "react";
import { Layout } from "@/components/Layout";

const ManageUsersView = () => (
  <Layout>
    <div className="view-page no-padding manage-users">
      <iframe className="borderless fullsize" src="/login/admin" />
    </div>
  </Layout>
);

export default ManageUsersView;
