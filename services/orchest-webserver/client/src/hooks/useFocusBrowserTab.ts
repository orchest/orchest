import React from "react";
import { useHasChanged } from "./useHasChanged";

// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

type Hidden = "hidden" | "msHidden" | "mozHidden" | "webkitHidden" | "oHidden";
type VisibilityState =
  | "visibilityState"
  | "msVisibilityState"
  | "mozVisibilityState"
  | "webkitVisibilityState"
  | "oVisibilityState";

type VisibilityChange =
  | "visibilitychange"
  | "msvisibilitychange"
  | "mozVisibilitychange"
  | "webkitvisibilitychange"
  | "oVisibilitychange";

const hasWindow = typeof window !== "undefined";

const browserPrefix = ["moz", "ms", "o", "webkit"];
const getPrefix = () => {
  if (!hasWindow) return null;
  if (typeof document.hidden !== "undefined") return null;

  const prefix = browserPrefix.find((prefix) => {
    const testPrefix = prefix + "Hidden";
    return testPrefix in document;
  });

  return prefix || null;
};

const prefixProperty = <T extends string>(
  prefix: string | null,
  property: T
) => {
  const capitalized = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1);
  return prefix ? (`${prefix}${capitalized(property)}` as T) : (property as T);
};

const prefix = getPrefix();
const hidden = prefixProperty<Hidden>(prefix, "hidden");
const visibilityState = prefixProperty<VisibilityState>(
  prefix,
  "visibilityState"
);
const visibilityChange = prefixProperty<VisibilityChange>(
  prefix,
  "visibilitychange"
);

const generateHandleVisibilityChange = (
  callback: (value: boolean) => void
) => () => {
  if (document[hidden]) {
    callback(false);
  } else {
    callback(true);
  }
};

export const useFocusBrowserTab = (disabled?: boolean) => {
  const handleVisibilityChangeRef = React.useRef<() => void>();
  const [isFocused, setIsFocused] = React.useState(
    hasWindow && document[visibilityState] === "visible"
  );
  if (!handleVisibilityChangeRef.current) {
    handleVisibilityChangeRef.current = generateHandleVisibilityChange(
      setIsFocused
    );
  }
  React.useEffect(() => {
    if (
      !disabled &&
      hasWindow &&
      document[hidden] !== undefined &&
      !!handleVisibilityChangeRef.current
    ) {
      document.addEventListener(
        visibilityChange,
        handleVisibilityChangeRef.current,
        false
      );
    }
    return () => {
      if (hasWindow && !!handleVisibilityChangeRef.current) {
        document.removeEventListener(
          visibilityChange,
          handleVisibilityChangeRef.current
        );
      }
    };
  }, [disabled]);
  return isFocused;
};

export const useRegainBrowserTabFocus = () => {
  const isTabFocused = useFocusBrowserTab();
  const hasBrowserFocusChanged = useHasChanged(
    isTabFocused,
    (prev, curr) => !prev && curr
  );

  return hasBrowserFocusChanged;
};
