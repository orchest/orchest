import { queryArgs, QueryArgsProps } from "@/pipeline-view/file-manager/common";
import React from "react";
import { useHistory } from "react-router-dom";

export const useUpdateQueryArgs = (delay = 500) => {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const history = useHistory();
  const updateQueryArgs = React.useCallback(
    (newQueryArgs: QueryArgsProps) => {
      setIsUpdating(true);
      window.setTimeout(() => {
        const queryString = queryArgs(newQueryArgs);
        history.replace(
          queryString
            ? `${window.location.pathname}?${queryArgs(newQueryArgs)}`
            : window.location.pathname
        );
        setIsUpdating(false);
      }, delay);
    },
    [history, delay]
  );

  return { updateQueryArgs, isUpdating };
};
