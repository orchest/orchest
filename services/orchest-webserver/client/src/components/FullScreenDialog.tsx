import { IconButton } from "@/components/common/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";

export type FullScreenDialogProps = React.PropsWithChildren<{
  title?: React.ReactNode;
  open: boolean;
  onClose?: () => void;
}>;

export const FullScreenDialog = ({
  children,
  title,
  open,
  onClose,
}: FullScreenDialogProps) => {
  if (!open) return null;

  return (
    <Backdrop open={open} sx={{ zIndex: 11 }}>
      <Box
        sx={{
          width: (theme) => `calc(100vw - ${theme.spacing(8)})`,
          margin: (theme) => theme.spacing(8, 0, 0),
          height: (theme) => `calc(100vh - ${theme.spacing(13)})`,
        }}
      >
        <Stack
          direction="column"
          sx={{
            backgroundColor: (theme) => theme.palette.background.paper,
            borderRadius: (theme) => theme.spacing(1),
            height: "100%",
            position: "relative",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{
              height: (theme) => theme.spacing(8),
              padding: (theme) => theme.spacing(1, 1, 1, 2),
            }}
          >
            <Stack
              sx={{ flex: 1, height: "100%" }}
              direction="row"
              justifyContent="flex-start"
              alignItems="center"
            >
              {title}
            </Stack>

            <IconButton
              size="large"
              sx={{ color: (theme) => theme.palette.grey[700] }}
              title="Close"
              onClick={() => onClose?.()}
            >
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ overflow: "hidden auto", flex: 1 }}>
            {open ? children : null}
          </Box>
        </Stack>
      </Box>
    </Backdrop>
  );
};
