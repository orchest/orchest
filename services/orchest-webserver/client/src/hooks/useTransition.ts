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

  React.useEffect(() => {
    let timeoutId: number;
    if (!isMounted && !shouldRender && timeoutId)
      window.clearTimeout(timeoutId);
    if (isMounted && !shouldRender) setShouldRender(true);
    if (!isMounted && shouldRender)
      timeoutId = window.setTimeout(() => setShouldRender(false), delayTime);

    return () => window.clearTimeout(timeoutId);
  }, [isMounted, transitionTime, shouldRender, delayTime]);

  return { shouldRender, mountedStyle, unmountedStyle };
};

export { useTransition };
