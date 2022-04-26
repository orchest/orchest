import { OverflowListener } from "@/utils/webserver-utils";
import React from "react";

export const useOverflowListener = (shouldLoad = true) => {
  const overflowListener = React.useMemo(() => new OverflowListener(), []);

  React.useEffect(() => {
    if (shouldLoad) overflowListener.attach();
    return () => {
      overflowListener.detach();
    };
  }, [overflowListener, shouldLoad]);
};
