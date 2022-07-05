import { Position } from "@/types";
import Divider from "@mui/material/Divider";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
type ContextMenuItemAction = {
  type: "item";
  title: string;
  disabled?: boolean;
  action: (props: { event: React.MouseEvent; position: Position }) => void;
};

type ContextMenuItemSeparator = {
  type: "separator";
};

export type ContextMenuItem = ContextMenuItemAction | ContextMenuItemSeparator;

export const PipelineEditorContextMenu: React.FC<{
  position: Position | undefined;
  onClose: MenuProps["onClose"];
  menuItems: ContextMenuItem[];
  onSelectMenuItem: (
    event: React.MouseEvent,
    item: ContextMenuItemAction,
    itemId?: string
  ) => void;
}> = ({ position, onClose, menuItems, onSelectMenuItem }) => {
  return (
    <Menu
      open={hasValue(position)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        hasValue(position) ? { top: position.y, left: position.x } : undefined
      }
    >
      {menuItems.map((menuItem) => {
        switch (menuItem.type) {
          case "item":
            return (
              <MenuItem
                key={menuItem.title}
                onClick={(e) => onSelectMenuItem(e, menuItem)}
                disabled={menuItem.disabled}
              >
                {menuItem.title}
              </MenuItem>
            );
          case "separator":
            return <Divider />;
          default:
            return null;
        }
      })}
    </Menu>
  );
};

export function useContextMenu() {
  const [position, setPosition] = React.useState<Position>();
  const onClose = React.useCallback(() => {
    setPosition(undefined);
  }, []);
  const onSelectMenuItem = React.useCallback(
    (event: React.MouseEvent, item: ContextMenuItemAction) => {
      if (!hasValue(position)) return;

      item.action({ event, position });
      onClose();
    },
    [position, onClose]
  );

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  return {
    position,
    handleContextMenu,
    onClose,
    onSelectMenuItem,
  };
}
