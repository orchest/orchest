import * as React from "react";
import { Layout } from "@/components/Layout";

const FileManagerView: React.FC = () => (
  <Layout>
    <div className="view-page no-padding">
      <iframe className="borderless fullsize" src="/container-file-manager" />
    </div>
  </Layout>
);

export default FileManagerView;
