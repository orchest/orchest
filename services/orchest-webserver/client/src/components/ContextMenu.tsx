import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import { ContextMenuUuid } from "@/pipeline-view/hooks/usePipelineUiState";
import { Point2D } from "@/utils/geometry";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export type ContextMenuContextType = {
  position: Point2D | undefined;
  handleContextMenu: (event: React.MouseEvent, uuid: ContextMenuUuid) => void;
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
  const { uiStateDispatch } = usePipelineUiStateContext();
  const [position, setPosition] = React.useState<Point2D>();
  const handleContextMenu = (
    event: React.MouseEvent,
    uuid: ContextMenuUuid
  ) => {
    event.preventDefault();
    event.stopPropagation();

    uiStateDispatch((current) => {
      // When there is already a ContextMenu open, it's transparent backdrop will cover the whole screen.
      // Therefore, the immediate right-click will always on the target of the first right-click.
      // E.g. right click on Step A, and then right click on the canvas, the second context menu is still on Step A.
      // The current workaround is closing the current context menu if the immediate second right-click occurs.
      const isOpen = Boolean(current.contextMenuUuid);
      if (!isOpen) {
        setPosition([event.clientX, event.clientY]);
        return {
          type: "SET_CONTEXT_MENU_UUID",
          payload: uuid,
        };
      } else {
        setPosition(undefined);
        return {
          type: "SET_CONTEXT_MENU_UUID",
          payload: undefined,
        };
      }
    });
  };

  const onClose = React.useCallback(() => {
    setPosition(undefined);
    uiStateDispatch({ type: "SET_CONTEXT_MENU_UUID", payload: undefined });
  }, [uiStateDispatch]);

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
  color?: string;
  disabled?: boolean;
  action: (props: { event: React.MouseEvent; position: Point2D }) => void;
};

type ContextMenuItemSeparator = { type: "separator" };

export type ContextMenuItem = ContextMenuItemAction | ContextMenuItemSeparator;

type ContextMenuProps = Omit<ContextMenuContextType, "handleContextMenu"> & {
  position: Point2D;
  menuItems: ContextMenuItem[];
};

export const ContextMenu = ({
  position: [x, y],
  onClose,
  onSelectMenuItem,
  menuItems,
}: ContextMenuProps) => {
  return (
    <Menu
      open={true}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
    >
      {menuItems.map((menuItem, index) => {
        switch (menuItem.type) {
          case "item":
            return (
              <MenuItem
                key={index}
                onClick={(e) => onSelectMenuItem(e, menuItem)}
                disabled={menuItem.disabled}
                sx={{ color: menuItem.color }}
              >
                {menuItem.title}
              </MenuItem>
            );
          case "separator":
            return <Divider key={index} />;
          default:
            return null;
        }
      })}
    </Menu>
  );
};
