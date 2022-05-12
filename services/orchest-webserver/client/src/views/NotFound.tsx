import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import React from "react";
import { useLocation } from "react-router-dom";

// TODO: Currently this component is not used, we need a proper Page Not Found page
// atm, wrong path will simply redirect back to ProjectsView

const NotFound: React.FC = () => {
  useSendAnalyticEvent("view:loaded", { name: siteMap.notFound.path });

  let location = useLocation();

  return (
    <div>
      <h3>
        Page Not Found: <code>{location.pathname}</code>
      </h3>
    </div>
  );
};

export { NotFound };
