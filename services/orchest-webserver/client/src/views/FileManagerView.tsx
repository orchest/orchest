import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";

const FileManagerView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.fileManager.path });

  return (
    <Layout>
      <div className="view-page no-padding">
        <iframe className="borderless fullsize" src="/container-file-manager" />
      </div>
    </Layout>
  );
};

export default FileManagerView;
