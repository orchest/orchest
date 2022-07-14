import React from "react";
import { PipelineOperationButton } from "./PipelineOperationButton";
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
      <PipelineOperationButton openMenu={openMenu} ref={buttonRef} />
      <PipelineOperationsMenu anchor={anchor} onClose={closeMenu} />
    </>
  );
};
