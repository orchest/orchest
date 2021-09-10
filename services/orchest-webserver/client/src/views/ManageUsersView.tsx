import * as React from "react";
import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const ManageUsersView: React.FC<TViewProps> = (props) => {
  useDocumentTitle(props.title);
  return (
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
};

export default ManageUsersView;
