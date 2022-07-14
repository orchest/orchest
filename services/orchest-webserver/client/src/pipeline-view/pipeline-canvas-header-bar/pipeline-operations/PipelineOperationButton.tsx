import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React from "react";
import { useRunSteps } from "./useRunSteps";

type PipelineOperationButtonProps = { openMenu: (e: React.MouseEvent) => void };

export const PipelineOperationButton = React.forwardRef<
  HTMLButtonElement,
  PipelineOperationButtonProps
>(function PipelineOperationButtonComponent({ openMenu }, ref) {
  const localRef = React.useRef<HTMLButtonElement>();
  const { runSelectedSteps, runAllSteps, shouldRunAll } = useRunSteps();

  return (
    <Button
      variant="contained"
      ref={(node: HTMLButtonElement) => {
        localRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      sx={{
        marginLeft: (theme) => theme.spacing(1),
        ":hover": {
          backgroundColor: (theme) => theme.palette.primary.main,
        },
      }}
      startIcon={<PlayCircleOutlineOutlinedIcon fontSize="small" />}
      endIcon={
        <Box
          sx={{
            margin: (theme) => theme.spacing(-2, -1.5, -2, 0),
            width: (theme) => theme.spacing(4),
            backgroundColor: (theme) => theme.palette.primary.dark,
          }}
        >
          <ArrowDropDownOutlinedIcon
            fontSize="small"
            onClick={openMenu}
            sx={{
              transform: (theme) => `translate(0, ${theme.spacing(0.5)})`,
            }}
          />
        </Box>
      }
      onClick={shouldRunAll ? runAllSteps : runSelectedSteps}
    >
      <Box sx={{ marginRight: (theme) => theme.spacing(1) }}>
        {shouldRunAll ? "Run all" : "Run selected"}
      </Box>
    </Button>
  );
});
