import { useAppContext } from "@/contexts/AppContext";
import { makeRequest } from "@orchest/lib-utils";
import React from "react";
import { useMounted } from "./useMounted";

// use this hook as a side effect by specifying the parameters, it will fire when the component mounts
// useSendAnalyticEvent('view load', { name: 'projectsView' });
// in this case, this hook doesn't return anything
// you can also use this hook as a factory, by leaving out the parameters
// const sendEvent = useSendAnalyticEvent();
// sendEvent("alert show", { title: 'Error', content: 'Could not find any pipelines for this project.' });

const useSendAnalyticEvent = (
  event?: string,
  props?: Record<string, unknown>
) => {
  const {
    state: { config },
  } = useAppContext();
  const isMounted = useMounted();
  const shouldSend = config?.TELEMETRY_DISABLED === false && isMounted;

  const send = React.useCallback(
    (innerEvent: string, innerProps?: Record<string, unknown>) => {
      if (shouldSend) {
        makeRequest("POST", "/analytics", {
          type: "json",
          content: innerProps
            ? {
                event: innerEvent,
                properties: innerProps,
              }
            : { event: innerEvent },
        });
      }
    },
    [shouldSend]
  );

  const hasSent = React.useRef(false);
  React.useEffect(() => {
    if (shouldSend && event && !hasSent.current) {
      hasSent.current = true;
      send(event, props);
    }
  }, [shouldSend]);
  return event ? undefined : send;
};

export { useSendAnalyticEvent };
