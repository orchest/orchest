import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";

export const FullViewportHolder = styled(Box)({
  width: "100%",
  height: "100%",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
  zIndex: 0,
});
