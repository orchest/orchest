import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import React from "react";

export const BackButton: React.FC<{
  onClick: (e: React.MouseEvent) => void;
}> = ({ children, onClick }) => {
  return (
    <Button
      startIcon={<ArrowBackIcon />}
      color="secondary"
      onClick={onClick}
      onAuxClick={onClick}
    >
      {children}
    </Button>
  );
};
