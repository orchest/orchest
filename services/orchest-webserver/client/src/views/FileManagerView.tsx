import { Layout } from "@/components/Layout";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";

const FileManagerView: React.FC = () => {
  useSendAnalyticEvent("view load", { name: siteMap.fileManager.path });

  return (
    <Layout disablePadding fullHeight>
      <div className="view-page no-padding fullheight">
        <iframe className="borderless fullsize" src="/container-file-manager" />
      </div>
    </Layout>
  );
};

export default FileManagerView;
