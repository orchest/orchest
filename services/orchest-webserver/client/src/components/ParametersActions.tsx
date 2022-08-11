import { IconButton } from "@/components/common/IconButton";
import { JsonSchemaType } from "@/hooks/useOpenSchemaFile";
import { JsonSchema, UISchemaElement } from "@jsonforms/core";
import MoreHorizOutlinedIcon from "@mui/icons-material/MoreHorizOutlined";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import React from "react";

export type ParameterViewingMode = "json" | "form";

export type ParametersActionsMenuItem = {
  label: string;
  action: (event: React.MouseEvent) => void;
  disabled?: boolean;
};

type ParametersActionsProps = {
  viewingMode: ParameterViewingMode;
  setViewingMode: (value: ParameterViewingMode) => void;
  parameterSchema: JsonSchema | undefined;
  parameterUiSchema: UISchemaElement | undefined;
  openSchemaFile: (
    event: React.MouseEvent<Element, MouseEvent>,
    type: JsonSchemaType
  ) => void;
  menuItems: ParametersActionsMenuItem[] | undefined;
};

export const ParametersActions = ({
  viewingMode,
  setViewingMode,
  parameterSchema,
  parameterUiSchema,
  openSchemaFile,
  menuItems,
}: ParametersActionsProps) => {
  const moreOptionsButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = React.useState(false);
  const openMoreOptions = () => setIsMoreOptionsOpen(true);
  const closeMoreOptions = () => setIsMoreOptionsOpen(false);

  return (
    <Stack direction="row" justifyContent="space-between">
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Step parameters viewing mode"
        value={viewingMode}
        onChange={(e, value) => setViewingMode(value)}
      >
        <ToggleButton value="json" disabled={viewingMode === "json"}>
          Json
        </ToggleButton>
        <ToggleButton value="form" disabled={viewingMode === "form"}>
          Form
        </ToggleButton>
      </ToggleButtonGroup>
      <IconButton
        title="More options"
        ref={moreOptionsButtonRef}
        onClick={openMoreOptions}
        id="more-options-button"
      >
        <MoreHorizOutlinedIcon />
      </IconButton>
      <Menu
        anchorEl={moreOptionsButtonRef.current}
        open={isMoreOptionsOpen}
        onClose={closeMoreOptions}
        MenuListProps={{
          dense: true,
          "aria-labelledby": "more-options-button",
        }}
      >
        <MenuList dense>
          <MenuItem
            onClick={(e) => openSchemaFile(e, "schema")}
            onAuxClick={(e) => openSchemaFile(e, "schema")}
          >
            {`${parameterSchema ? "Edit" : "New"} schema file`}
          </MenuItem>
          <MenuItem
            disabled={!parameterSchema}
            onClick={(event) => openSchemaFile(event, "uischema")}
            onAuxClick={(event) => openSchemaFile(event, "uischema")}
          >
            {`${parameterUiSchema ? "Edit" : "New"} UI schema file`}
          </MenuItem>
          {menuItems?.map((menuItem) => {
            const handleClick = (event: React.MouseEvent) => {
              closeMoreOptions();
              menuItem.action(event);
            };
            return (
              <MenuItem
                key={menuItem.label}
                disabled={menuItem.disabled}
                onClick={handleClick}
                onAuxClick={handleClick}
              >
                {menuItem.label}
              </MenuItem>
            );
          })}
        </MenuList>
      </Menu>
    </Stack>
  );
};
