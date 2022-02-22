import StyledButtonOutlined from "@/styled-components/StyledButton";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { darken } from "@mui/material/styles";
import React from "react";

export const BackToJobButton = ({
  onClick,
}: {
  onClick: (e: React.MouseEvent) => void;
}) => {
  return (
    <StyledButtonOutlined
      variant="outlined"
      color="secondary"
      sx={{
        backgroundColor: (theme) => theme.palette.background.default,
        borderColor: (theme) => darken(theme.palette.background.default, 0.2),
        "&:hover": {
          backgroundColor: (theme) =>
            darken(theme.palette.background.default, 0.1),
          borderColor: (theme) => darken(theme.palette.background.default, 0.3),
        },
      }}
      startIcon={<ArrowBackIcon />}
      onClick={onClick}
      onAuxClick={onClick}
      data-test-id="pipeline-back-to-job"
    >
      Back to job
    </StyledButtonOutlined>
  );
};
