import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { alpha } from "@mui/material";
import Box from "@mui/material/Box";
import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";

export type CreateEntityButtonProps = ButtonProps & {
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
};

export const CreateEntityButton = ({
  onClick,
  children,
  sx,
  ...props
}: CreateEntityButtonProps) => {
  return (
    <Box
      sx={{
        width: "100%",
        padding: (theme) => theme.spacing(1, 2),
      }}
    >
      <Button
        fullWidth
        variant="contained"
        startIcon={<AddOutlinedIcon />}
        onClick={onClick}
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          color: (theme) => theme.palette.primary.main,
          ":hover": {
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
          },
          ...sx,
        }}
        {...props}
      >
        <Box
          sx={{
            marginTop: (theme) => theme.spacing(0.25),
            marginRight: (theme) => theme.spacing(1),
          }}
        >
          {children}
        </Box>
      </Button>
    </Box>
  );
};
