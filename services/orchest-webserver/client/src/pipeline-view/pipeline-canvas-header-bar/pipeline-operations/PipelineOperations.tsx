import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import PlayCircleOutlineOutlinedIcon from "@mui/icons-material/PlayCircleOutlineOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React from "react";
import { PipelineOperationsMenu } from "./PipelineOperationsMenu";

export const PipelineOperations = () => {
  const buttonRef = React.useRef(null);
  const [anchor, setAnchor] = React.useState<Element>();
  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (buttonRef.current) setAnchor(buttonRef.current);
  };
  const closeMenu = () => setAnchor(undefined);

  return (
    <>
      <Button
        variant="contained"
        ref={buttonRef}
        sx={{
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
      >
        <Box sx={{ marginRight: (theme) => theme.spacing(1) }}>Run all</Box>
      </Button>
      <PipelineOperationsMenu anchor={anchor} onClose={closeMenu} />
    </>
  );
};
