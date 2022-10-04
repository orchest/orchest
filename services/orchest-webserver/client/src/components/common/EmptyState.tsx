import { ViewDocsLink } from "@/components/common/ViewDocsLink";
import Box from "@mui/material/Box";
import Stack, { StackProps } from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type EmptyStateProps = StackProps & {
  imgSrc: string;
  title: string;
  description: string;
  docPath?: string;
  actions?: React.ReactNode;
};

export const EmptyState = ({
  imgSrc,
  title,
  description,
  docPath,
  sx,
  actions,
  ...props
}: EmptyStateProps) => {
  return (
    <Stack
      direction="column"
      alignItems="center"
      sx={{ zIndex: 1, ...sx }}
      {...props}
    >
      <Box
        component="img"
        src={imgSrc}
        sx={{
          width: "80%",
          userSelect: "none",
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
      {
        <Stack
          spacing={2}
          direction="row"
          sx={{ marginTop: (theme) => theme.spacing(4) }}
        >
          {actions}
          {docPath && <ViewDocsLink docPath={docPath} />}
        </Stack>
      }
    </Stack>
  );
};
