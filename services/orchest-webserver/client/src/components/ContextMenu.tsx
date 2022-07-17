import { usePipelineEditorContext } from "@/pipeline-view/contexts/PipelineEditorContext";
import { Position } from "@/types";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export type ContextMenuContextType = {
  position: Position | undefined;
  handleContextMenu: (event: React.MouseEvent) => void;
  onClose: () => void;
  onSelectMenuItem: (
    event: React.MouseEvent,
    item: ContextMenuItemAction
  ) => void;
};

export const ContextMenuContext = React.createContext<ContextMenuContextType>(
  {} as ContextMenuContextType
);

export const useContextMenuContext = () => React.useContext(ContextMenuContext);

export const ContextMenuContextProvider: React.FC = ({ children }) => {
  const { setIsContextMenuOpen } = usePipelineEditorContext();
  const [position, setPosition] = React.useState<Position>();
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setIsContextMenuOpen(true);
  };

  const onClose = React.useCallback(() => {
    setPosition(undefined);
    setIsContextMenuOpen(false);
  }, [setIsContextMenuOpen]);

  const onSelectMenuItem = React.useCallback(
    (event: React.MouseEvent, item: ContextMenuItemAction) => {
      if (!hasValue(position)) return;

      item.action({ event, position });
      onClose();
    },
    [position, onClose]
  );

  return (
    <ContextMenuContext.Provider
      value={{ position, handleContextMenu, onClose, onSelectMenuItem }}
    >
      {children}
    </ContextMenuContext.Provider>
  );
};

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

export const ContextMenu = ({
  position,
  onClose,
  onSelectMenuItem,
  menuItems,
}: Omit<ContextMenuContextType, "handleContextMenu"> & {
  menuItems: ContextMenuItem[];
}) => {
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
