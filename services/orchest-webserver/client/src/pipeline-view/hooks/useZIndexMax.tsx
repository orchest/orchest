import React from "react";

export const useUpdateZIndex = (
  shouldUpdate: boolean,
  zIndexMax: React.MutableRefObject<number | "unset">,
  amount = 0
) => {
  const [zIndex, setZIndex] = React.useState<"unset" | number>("unset");
  React.useEffect(() => {
    if (shouldUpdate) {
      zIndexMax.current =
        zIndexMax.current === "unset" ? amount : zIndexMax.current + amount + 1;
      setZIndex(zIndexMax.current);
    }
  }, [shouldUpdate, zIndexMax, amount]);

  return zIndex;
};
