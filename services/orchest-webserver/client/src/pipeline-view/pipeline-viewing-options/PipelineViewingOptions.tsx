import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import ButtonGroup from "@mui/material/ButtonGroup";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import React from "react";
import { PipelineViewingOptionsMenu } from "./PipelineViewingOptionsMenu";
import { ScaleFactorField } from "./ScaleFactorField";
import { ZoomInButton, ZoomOutButton } from "./ZoomButton";

export const PipelineViewingOptions = () => {
  const buttonGroupRef = React.useRef<HTMLDivElement | null>(null);

  const [anchor, setAnchor] = React.useState<Element>();
  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (buttonGroupRef.current) setAnchor(buttonGroupRef.current);
  };
  const closeMenu = React.useCallback(() => setAnchor(undefined), []);

  return (
    <>
      <ButtonGroup
        ref={buttonGroupRef}
        size="small"
        color="secondary"
        aria-label="pipeline viewing options"
        sx={{ backgroundColor: (theme) => theme.palette.background.paper }}
      >
        <ZoomOutButton />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            width: (theme) => theme.spacing(16),
            border: (theme) => `1px solid ${theme.palette.grey[400]}`,
            padding: (theme) => theme.spacing(0.5, 0, 0.5, 1.5),
          }}
        >
          <ScaleFactorField />
          <IconButton onClick={openMenu} arial-label="Open viewing options">
            <ArrowDropDownOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
        <ZoomInButton />
      </ButtonGroup>
      <PipelineViewingOptionsMenu anchor={anchor} onClose={closeMenu} />
    </>
  );
};
