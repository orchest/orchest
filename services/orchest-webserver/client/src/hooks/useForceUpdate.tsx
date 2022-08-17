import React from "react";

export const useForceUpdate = () => {
  const [updateCount, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  return [updateCount, forceUpdate] as const;
};
