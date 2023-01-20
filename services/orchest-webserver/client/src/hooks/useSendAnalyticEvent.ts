import { useOrchestConfigsApi } from "@/api/system-config/useOrchestConfigsApi";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";
import React from "react";
import { useMounted } from "./useMounted";

// use this hook as a side effect by specifying the parameters, it will fire when the component mounts
// useSendAnalyticEvent('view:loaded', { name: 'home' });
// in this case, this hook doesn't return anything
// you can also use this hook as a factory, by leaving out the parameters
// const sendEvent = useSendAnalyticEvent();
// sendEvent("alert:shown", { title: 'Error', content: 'Could not find any pipelines for this project.' });

type StringifyReactElement =
  | string
  | number
  | boolean
  | React.ReactElement
  | Record<
      string,
      React.ReactNode | React.ReactElement | string | number | boolean
    >;

const stringifyReactElement = (
  target: StringifyReactElement | StringifyReactElement[]
) => {
  if (!target) return "";
  if (Array.isArray(target)) {
    return target.reduce(
      (all, item) => `${all}${stringifyReactElement(item)}`,
      ""
    );
  }
  if (typeof target === "string") return target;
  if (typeof target === "number" || typeof target === "boolean")
    return JSON.stringify(target);
  // Object literal
  if (
    typeof target === "object" &&
    !Array.isArray(target) &&
    target !== null &&
    !hasValue(target.props?.children)
  ) {
    return Object.values(target).reduce((all, value) => {
      if (!value || value === "br") return all;
      const child = stringifyReactElement(value.props?.children || value);
      return child ? `${all}${child}` : all;
    }, "");
  }
  // ReactElement[]
  if (React.isValidElement(target) && target.props.children?.length) {
    if (typeof target.props.children === "string") return target.props.children;
    return target.props.children.reduce(
      (all: string, current: React.ReactElement) => {
        return `${all}${stringifyReactElement(current)}`;
      },
      ""
    );
  }

  // Symbol(react.element)
  return "";
};

const stringifyObjectWithReactElements = (
  obj:
    | StringifyReactElement
    | StringifyReactElement[]
    | Record<string, StringifyReactElement>
) =>
  JSON.stringify(obj, (key, value) => {
    if (React.isValidElement(value)) return stringifyReactElement(value);
    if (Array.isArray(value)) return stringifyReactElement(value);
    return value;
  });

const useSendAnalyticEvent = (
  event?: string | undefined,
  props?: StringifyReactElement
) => {
  const config = useOrchestConfigsApi((state) => state.config);
  const mounted = useMounted();
  const shouldSend = config?.TELEMETRY_DISABLED === false && mounted.current;

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
    // it should take whatever in the given render
  }, [shouldSend]); // eslint-disable-line react-hooks/exhaustive-deps

  return send;
};

export { useSendAnalyticEvent };
