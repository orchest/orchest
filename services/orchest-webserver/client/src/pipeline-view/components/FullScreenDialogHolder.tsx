import { IconButton } from "@/components/common/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import React from "react";
import {
  PipelineFullscreenTabType,
  usePipelineCanvasContext,
} from "../contexts/PipelineCanvasContext";

type CloseButtonProps = {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
};

const CloseButton = ({ onClick }: CloseButtonProps) => {
  return (
    <IconButton
      size="large"
      sx={{ color: (theme) => theme.palette.grey[700] }}
      title="Close"
      onClick={onClick}
    >
      <CloseIcon />
    </IconButton>
  );
};

type FullScreenDialogHolderProps = {
  dialogId: PipelineFullscreenTabType | PipelineFullscreenTabType[];
  title: string | React.ReactNode;
};

export const FullScreenDialogHolder: React.FC<FullScreenDialogHolderProps> = ({
  children,
  dialogId,
  title,
}) => {
  const { fullscreenTab, setFullscreenTab } = usePipelineCanvasContext();
  const isOpen = Array.isArray(dialogId)
    ? dialogId.includes(fullscreenTab)
    : fullscreenTab === dialogId;
  const onClose = () => setFullscreenTab(undefined);

  return (
    <>
      {isOpen ? (
        <>
          <Backdrop open={isOpen}>
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
                  <CloseButton onClick={onClose} />
                </Stack>
                <Box sx={{ overflow: "hidden auto", flex: 1 }}>
                  {isOpen ? children : null}
                </Box>
              </Stack>
            </Box>
          </Backdrop>
        </>
      ) : null}
    </>
  );
};
