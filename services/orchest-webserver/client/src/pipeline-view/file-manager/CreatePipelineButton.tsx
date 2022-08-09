import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { alpha } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React from "react";

type CreatePipelineButtonProps = {
  onClick: () => void;
  disabled: boolean;
};

export const CreatePipelineButton = ({
  onClick,
  disabled,
}: CreatePipelineButtonProps) => {
  return (
    <Box
      sx={{
        width: "100%",
        padding: (theme) => theme.spacing(1, 2),
      }}
    >
      <Button
        fullWidth
        disabled={disabled}
        variant="contained"
        startIcon={<AddOutlinedIcon />}
        onClick={onClick}
        data-test-id="pipeline-create"
        sx={{
          backgroundColor: (theme) => theme.palette.background.paper,
          color: (theme) => theme.palette.primary.main,
          ":hover": {
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <Box
          sx={{
            marginTop: (theme) => theme.spacing(0.25),
            marginRight: (theme) => theme.spacing(1),
          }}
        >
          New pipeline
        </Box>
      </Button>
    </Box>
  );
};
