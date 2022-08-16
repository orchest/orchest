import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

export const BaseImageHeader = () => {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography component="h3" variant="body1">
        Base image
      </Typography>
      <Tooltip
        title={
          <Typography variant="caption" component="span">
            {`Base images can be extended using the setup script below (see `}
            <Link
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.orchest.io/en/latest/fundamentals/environments.html"
            >
              docs
            </Link>
            ).
          </Typography>
        }
        placement="right"
        arrow
      >
        <InfoOutlinedIcon
          fontSize="small"
          color="primary"
          style={{ width: "24px", height: "24px" }}
        />
      </Tooltip>
    </Stack>
  );
};
