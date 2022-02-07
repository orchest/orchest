import { useAppContext } from "@/contexts/AppContext";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useMounted } from "./useMounted";

// use this hook as a side effect by specifying the parameters, it will fire when the component mounts
// useSendAnalyticEvent('view load', { name: 'projectsView' });
// in this case, this hook doesn't return anything
// you can also use this hook as a factory, by leaving out the parameters
// const sendEvent = useSendAnalyticEvent();
// sendEvent("alert show", { title: 'Error', content: 'Could not find any pipelines for this project.' });

type StringifyReactElement =
  | string
  | number
  | boolean
  | React.ReactElement
  | Record<
      string,
      React.ReactNode | React.ReactElement | string | number | boolean
    >;

const stringifyReactElement = (target: StringifyReactElement) => {
  if (typeof target === "string") return target;
  if (typeof target === "number" || typeof target === "boolean")
    return JSON.stringify(target);
  // Object literal
  if (
    typeof target === "object" &&
    target !== null &&
    !hasValue(target.props?.children)
  ) {
    return Object.entries(target).reduce((all, [key, value]) => {
      const child = !value.props?.children
        ? value
        : stringifyReactElement(value);
      console.log(child);
      return `${all}, ${JSON.stringify({
        [key]: stringifyReactElement(child),
      })}`;
    }, "");
  }
  // ReactElement[]
  if (React.isValidElement(target) && target.props.children?.length) {
    if (typeof target.props.children === "string") return target.props.children;
    return target.props.children.reduce(
      (all: string, current: React.ReactElement) => {
        return `${all} ${stringifyReactElement(current)}`;
      },
      ""
    );
  }
  // ReactElement
  return stringifyReactElement(target);
};

const stringifyObjectWithReactElements = (
  obj: StringifyReactElement | Record<string, StringifyReactElement>
) =>
  JSON.stringify(obj, (key, value) => {
    if (React.isValidElement(value)) return stringifyReactElement(value);
    return value;
  });

const useSendAnalyticEvent = (
  event?: string,
  props?: StringifyReactElement
) => {
  const {
    state: { config },
  } = useAppContext();
  const isMounted = useMounted();
  const shouldSend = config?.TELEMETRY_DISABLED === false && isMounted;

  const send = React.useCallback(
    (innerEvent: string, innerProps?: StringifyReactElement) => {
      if (shouldSend) {
        fetcher("/analytics", {
          method: "POST",
          headers: HEADER.JSON,
          body: stringifyObjectWithReactElements(
            innerProps
              ? {
                  event: innerEvent,
                  properties: innerProps,
                }
              : { event: innerEvent }
          ),
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
