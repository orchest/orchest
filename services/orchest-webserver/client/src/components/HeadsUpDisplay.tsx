import { Stack } from "@mui/material";
import { styled } from "@mui/material/styles";

export const HeadsUpDisplay = styled(Stack)({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  maxWidth: "100%",
  maxHeight: "100%",
  pointerEvents: "none",
  display: "flex",
  flexDirection: "column",
  zIndex: 0,
  "> *": {
    pointerEvents: "auto",
  },
});
