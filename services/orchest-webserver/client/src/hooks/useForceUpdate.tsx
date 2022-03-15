import React from "react";

export const useForceUpdate = () => {
  const [shouldUpdate, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  return [shouldUpdate, forceUpdate] as const;
};
