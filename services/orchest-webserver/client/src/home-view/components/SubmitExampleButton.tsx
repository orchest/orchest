import LaunchOutlined from "@mui/icons-material/LaunchOutlined";
import Button, { ButtonProps } from "@mui/material/Button";
import React from "react";

export const SubmitExampleButton = (props: ButtonProps) => {
  const onClick = () =>
    window.open(
      "https://github.com/orchest/orchest-examples",
      "_blank",
      "noopener,noreferrer"
    );

  return (
    <Button
      {...props}
      onClick={onClick}
      data-test-id="submit-example-button"
      endIcon={<LaunchOutlined />}
    >
      Submit example
    </Button>
  );
};
