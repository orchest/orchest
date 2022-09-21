import { queryArgs, QueryArgsProps } from "@/utils/text";
import React from "react";
import { useHistory } from "react-router-dom";

export const useUpdateQueryArgs = (delay = 500) => {
  const isUpdatingRef = React.useRef(false);
  const history = useHistory();
  const updateQueryArgs = React.useCallback(
    (newQueryArgs: QueryArgsProps) => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;
      window.setTimeout(() => {
        const queryString = queryArgs(newQueryArgs);
        history.replace(
          queryString
            ? `${window.location.pathname}?${queryArgs(newQueryArgs)}`
            : window.location.pathname
        );
        isUpdatingRef.current = false;
      }, delay);
    },
    [history, delay]
  );

  return { updateQueryArgs };
};
