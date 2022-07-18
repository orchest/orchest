import { useClickOutside } from "@/hooks/useClickOutside";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import { isMacOs } from "@/utils/isMacOs";
import { isNumber } from "@/utils/webserver-utils";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import RemoveIcon from "@mui/icons-material/Remove";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputBase from "@mui/material/InputBase";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { useScaleFactor } from "../contexts/ScaleFactorContext";

const osSpecificHotKey = isMacOs() ? "⌘" : "Ctrl";

type MenuItemData =
  | {
      type: "item";
      label: string;
      action?: () => void;
      hotKey?: string;
    }
  | {
      type: "separator";
    };

export const PipelineViewingOptions = () => {
  const { scaleFactor, setScaleFactor } = useScaleFactor();
  const { zoomIn, zoomOut, centerView } = usePipelineCanvasContext();
  const { autoLayoutPipeline } = usePipelineUiStateContext();
  const scaleFactorInPercentage = Math.round(scaleFactor * 100);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = Number(e.target.value);
    if (isNumber(value)) {
      setScaleFactor(value / 100);
    }
  };

  const buttonGroupRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const textFieldRef = React.useRef<HTMLInputElement | null>(null);

  const [anchor, setAnchor] = React.useState<Element>();
  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (buttonGroupRef.current) setAnchor(buttonGroupRef.current);
  };
  const closeMenu = () => setAnchor(undefined);

  useClickOutside([textFieldRef, menuRef], () => {
    closeMenu;
  });

  const menuItems: readonly MenuItemData[] = [
    {
      type: "item",
      label: "Zoom in",
      action: () => zoomIn(),
      hotKey: `${osSpecificHotKey} Arrow up`,
    },
    {
      type: "item",
      label: "Zoom out",
      action: () => zoomOut(),
      hotKey: `${osSpecificHotKey} Arrow down`,
    },
    { type: "separator" },
    {
      type: "item",
      label: "Center view",
      action: () => centerView(),
      hotKey: "h",
    },
    {
      type: "item",
      label: "Auto layout",
      action: () => autoLayoutPipeline(),
      hotKey: `${osSpecificHotKey} shift o`,
    },
  ];

  return (
    <>
      <ButtonGroup
        ref={buttonGroupRef}
        size="small"
        color="secondary"
        aria-label="pipeline viewing options"
        sx={{ backgroundColor: (theme) => theme.palette.background.paper }}
      >
        <Button
          onClick={() => zoomOut()}
          arial-label="Zoom out"
          sx={{
            borderColor: (theme) => theme.palette.grey[400],
            padding: (theme) => theme.spacing(0.375, 0.875),
          }}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </Button>
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
          <InputBase
            ref={textFieldRef}
            size="small"
            type="number"
            value={scaleFactorInPercentage}
            inputProps={{
              inputMode: "numeric",
              sx: {
                padding: 0,
                width: (theme) => theme.spacing(4),
              },
            }}
            margin="dense"
            endAdornment={
              <InputAdornment position="end" sx={{ marginLeft: 0 }}>
                %
              </InputAdornment>
            }
            sx={{
              border: "none",
              display: "flex",
              alignItems: "center",
              padding: 0,
              //   marginLeft: (theme) => theme.spacing(0.5),
            }}
            onChange={handleChange}
          />
          <IconButton onClick={openMenu} arial-label="Open viewing options">
            <ArrowDropDownOutlinedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
        <Button
          onClick={() => zoomIn()}
          arial-label="Zoom in"
          sx={{
            borderColor: (theme) => theme.palette.grey[400],
            padding: (theme) => theme.spacing(0.375, 0.875),
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </Button>
      </ButtonGroup>
      <Menu
        id="pipeline-viewing-options-menu"
        ref={menuRef}
        anchorEl={anchor}
        open={hasValue(anchor)}
        onClose={closeMenu}
        MenuListProps={{
          dense: true,
          "aria-labelledby": "pipeline-operations",
          sx: { width: (theme) => theme.spacing(28) },
        }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {menuItems.map((option) => {
          if (option.type === "separator") return <Divider />;
          const disabled = !hasValue(option.action);
          return (
            <MenuItem
              key={option.label}
              disabled={disabled}
              onClick={option.action}
            >
              <ListItemText>{option.label}</ListItemText>
              <Typography variant="caption" color="text.secondary">
                {option.hotKey}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
