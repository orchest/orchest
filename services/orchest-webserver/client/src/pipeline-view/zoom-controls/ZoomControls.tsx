import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import ButtonGroup from "@mui/material/ButtonGroup";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import React from "react";
import { ZoomInButton, ZoomOutButton } from "./ZoomButton";
import { ZoomOptionsMenu } from "./ZoomOptionsMenu";
import { ZoomValueField } from "./ZoomValueField";

export const ZoomControls = () => {
  const buttonGroupRef = React.useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = React.useState<Element>();

  const openMenu = () => setAnchor(buttonGroupRef.current ?? undefined);

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
          <ZoomValueField />
          <IconButton onClick={openMenu} arial-label="Open viewing options">
            <ArrowDropDownOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
        <ZoomInButton />
      </ButtonGroup>
      <ZoomOptionsMenu anchor={anchor} onClose={closeMenu} />
    </>
  );
};
