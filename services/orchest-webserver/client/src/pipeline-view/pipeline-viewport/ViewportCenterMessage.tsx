import { ViewDocsLink } from "@/components/common/ViewDocsLink";
import Box from "@mui/material/Box";
import Stack, { StackProps } from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type ViewportCenterMessageProps = StackProps & {
  imgSrc: string;
  title: string;
  description: string;
  docPath?: string;
};

export const ViewportCenterMessage = ({
  imgSrc,
  title,
  description,
  docPath,
  sx,
  ...props
}: ViewportCenterMessageProps) => {
  return (
    <Stack
      direction="column"
      alignItems="center"
      sx={{ marginTop: (theme) => theme.spacing(4), zIndex: 1, ...sx }}
      {...props}
    >
      <Box
        component="img"
        src={imgSrc}
        sx={{
          width: "80%",
          maxWidth: (theme) => theme.spacing(40),
          marginBottom: (theme) => theme.spacing(2),
        }}
      />
      <Typography variant="h5">{title}</Typography>
      <Typography
        variant="body1"
        align="center"
        sx={{
          width: (theme) => theme.spacing(44),
          marginTop: (theme) => theme.spacing(1),
        }}
      >
        {description}
      </Typography>
      <ViewDocsLink
        sx={{ marginTop: (theme) => theme.spacing(4) }}
        docPath={docPath}
      />
    </Stack>
  );
};
