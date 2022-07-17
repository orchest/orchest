import { Position } from "@/types";
import React from "react";

export type ContextMenuContextType = {
  position: Position | undefined;
  handleContextMenu: (event: React.MouseEvent) => void;
};

export const ContextMenuContext = React.createContext<ContextMenuContextType>(
  {} as ContextMenuContextType
);

export const useContextMenuContext = () => React.useContext(ContextMenuContext);

export const ContextMenuContextProvider: React.FC = ({ children }) => {
  const [position, setPosition] = React.useState<Position>();
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    setPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <ContextMenuContext.Provider value={{ position, handleContextMenu }}>
      {children}
    </ContextMenuContext.Provider>
  );
};
