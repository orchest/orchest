import React from "react";
import { useLocation } from "react-router-dom";
const NotFound = () => {
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
