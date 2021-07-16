import * as React from "react";
import type { IViewProps } from "@/types";
import { Layout } from "@/components/Layout";

const FileManagerView: React.FC<IViewProps> = () => (
  <Layout>
    <div className="view-page no-padding">
      <iframe className="borderless fullsize" src="/container-file-manager" />
    </div>
  </Layout>
);

export default FileManagerView;
