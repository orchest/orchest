import React from "react";
import { PROJECT_TAB, useProjectTabsContext } from "./ProjectTabsContext";

export const ActionButtonsContainer: React.FC<{
  projectTabIndex: PROJECT_TAB;
}> = ({ projectTabIndex, children }) => {
  const state = useProjectTabsContext();

  return <>{projectTabIndex === state.projectTabIndex ? children : null}</>;
};
