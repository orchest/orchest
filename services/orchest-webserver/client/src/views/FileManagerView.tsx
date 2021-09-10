import React from "react";
import type { TViewProps } from "@/types";
import { Layout } from "@/components/Layout";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const FileManagerView: React.FC<TViewProps> = (props) => {
  useDocumentTitle(props.title);
  return (
    <Layout>
      <div className="view-page no-padding">
        <iframe className="borderless fullsize" src="/container-file-manager" />
      </div>
    </Layout>
  );
};

export default FileManagerView;
