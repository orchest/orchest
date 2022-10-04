import { styled, SxProps, Theme } from "@mui/material/styles";
import React from "react";

const OverflowContainer = styled("div")(() => ({
  overflowY: "auto",
  overflowX: "hidden",
  flex: 1,
}));

// this container increase padding-right if the vertical scrollbar appears
// * NOTE: this container requires a parent container with display: flex
export const Overflowable: React.FC<{
  sx?: SxProps<Theme>;
  style?: React.CSSProperties;
}> = ({ children, sx, style }) => {
  const [overflown, setOverflown] = React.useState(false);
  const onOverflown = React.useCallback(() => setOverflown(true), []);
  React.useEffect(() => {
    window.addEventListener("overflow", onOverflown, false);
    return () => {
      window.removeEventListener("overflow", onOverflown);
    };
  }, [onOverflown]);
  return (
    <OverflowContainer
      sx={{
        ...sx,
        ...(overflown ? { paddingRight: (theme) => theme.spacing(2.5) } : null),
      }}
      style={style}
    >
      {children}
    </OverflowContainer>
  );
};
