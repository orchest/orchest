import React from "react";

const getTransition = (time: number) => `opacity ${time.toString()}ms ease-in`;

const useTransition = (
  isMounted: boolean,
  transitionTime = 250,
  delayTime = 0
) => {
  const [shouldRender, setShouldRender] = React.useState(false);

  const transition = getTransition(transitionTime);

  const mountedStyle = { opacity: 1, transition };
  const unmountedStyle = { opacity: 0, transition };

  const timeoutId = React.useRef(0);

  React.useEffect(() => {
    if (!isMounted && !shouldRender && timeoutId.current)
      window.clearTimeout(timeoutId.current);
    if (isMounted && !shouldRender) setShouldRender(true);
    if (!isMounted && shouldRender)
      timeoutId.current = window.setTimeout(
        () => setShouldRender(false),
        delayTime
      );

    return () => window.clearTimeout(timeoutId.current);
  }, [isMounted, transitionTime, shouldRender, delayTime]);

  return { shouldRender, mountedStyle, unmountedStyle };
};

export { useTransition };
