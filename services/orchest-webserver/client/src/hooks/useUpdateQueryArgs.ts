import { queryArgs, QueryArgsProps } from "@/pipeline-view/file-manager/common";
import React from "react";
import { useHistory } from "react-router-dom";

export const useUpdateQueryArgs = (delay = 500) => {
  const history = useHistory();
  const updateQueryArgs = React.useCallback(
    (newQueryArgs: QueryArgsProps) => {
      window.setTimeout(() => {
        const queryString = queryArgs(newQueryArgs);
        history.replace(
          queryString
            ? `${window.location.pathname}?${queryArgs(newQueryArgs)}`
            : window.location.pathname
        );
      }, delay);
    },
    [history, delay]
  );

  return updateQueryArgs;
};
