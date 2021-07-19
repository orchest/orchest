import * as React from "react";
import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";

const FileManagerView: React.FC<TViewProps> = () => (
  <Layout>
    <div className="view-page no-padding">
      <iframe className="borderless fullsize" src="/container-file-manager" />
    </div>
  </Layout>
);

export default FileManagerView;
