import React from "react";

export const useUpdateZIndex = (
  shouldUpdate: boolean,
  zIndexMax: React.MutableRefObject<number | "unset">,
  amount = 0 // in case that you need to lift the element more than 1
) => {
  const [zIndex, setZIndex] = React.useState<"unset" | number>("unset");
  React.useEffect(() => {
    if (!shouldUpdate) setZIndex("unset");
    if (shouldUpdate) {
      zIndexMax.current =
        zIndexMax.current === "unset" ? amount : zIndexMax.current + amount + 1;
      setZIndex(zIndexMax.current);
    }
  }, [shouldUpdate, zIndexMax, amount]);

  return zIndex;
};
