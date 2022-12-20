import React from "react";

export const useToggle = (initialState = false) => {
  const [toggled, setToggled] = React.useState(initialState);

  const toggle = React.useCallback((newState?: boolean) => {
    if (newState) setToggled(newState);
    else setToggled((current) => !current);
  }, []);

  return [toggled, toggle] as const;
};
