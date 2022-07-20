import Box from "@mui/material/Box";
import React from "react";

export const FullViewportHolder: React.FC = ({ children }) => (
  <Box
    sx={{
      width: "100%" /* Full width (cover the whole page) */,
      height: "100%" /* Full height (cover the whole page) */,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {children}
  </Box>
);
