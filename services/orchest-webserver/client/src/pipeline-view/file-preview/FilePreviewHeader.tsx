import { FileDescription } from "@/api/file-viewer/fileViewerApi";
import { ellipsis } from "@/utils/styles";
import MoreHorizOutlined from "@mui/icons-material/MoreHorizOutlined";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

export type FilePreviewHeaderProps = { file: FileDescription };

export const FilePreviewHeader = ({ file }: FilePreviewHeaderProps) => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      width="inherit"
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        borderBottom: (theme) => `1px solid ${theme.borderColor}`,
        padding: (theme) => theme.spacing(0, 3, 0, 2),
        height: (theme) => theme.spacing(7),
      }}
    >
      <Stack
        direction="row"
        alignItems="baseline"
        minWidth={0}
        flexShrink={1}
        width="inherit"
      >
        <Typography component="h2" variant="h5" sx={ellipsis()}>
          {file.filename}
        </Typography>
      </Stack>
      <Stack direction="row" flexShrink={0} spacing={1.5} alignItems="center">
        <Button>Hide connections</Button>
        <Button variant="contained">Edit in JupyterLab</Button>
        <IconButton title="More options" size="small">
          <MoreHorizOutlined fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
};
