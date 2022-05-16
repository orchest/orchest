import { styled } from "@mui/material/styles";

export const ResizeBar = styled("div")(({ theme }) => ({
  position: "absolute",
  top: 0,
  height: "100%",
  width: theme.spacing(1),
  marginLeft: theme.spacing(-0.5),
  userSelect: "none",
  cursor: "col-resize",
}));
