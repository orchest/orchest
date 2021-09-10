import React from "react";
import { useLocation } from "react-router-dom";

import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { TViewProps } from "@/types";

// TODO: Currently this component is not used, we need a proper Page Not Found page
// atm, wrong path will simply redirect back to ProjectsView

const NotFound: React.FC<TViewProps> = (props) => {
  useDocumentTitle(props.title);
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
