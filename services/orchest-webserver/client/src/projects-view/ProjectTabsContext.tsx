import { useCustomRoute } from "@/hooks/useCustomRoute";
import React from "react";

export enum PROJECT_TAB {
  "MY_PROJECTS" = 0,
  "EXAMPLE_PROJECTS" = 1,
}

export type ProjectTabsContextType = {
  projectTabIndex: PROJECT_TAB;
  setProjectTabIndex: React.Dispatch<React.SetStateAction<PROJECT_TAB>>;
};

export const ProjectTabsContext = React.createContext<ProjectTabsContextType>({
  projectTabIndex: PROJECT_TAB.MY_PROJECTS,
} as ProjectTabsContextType);

export const useProjectTabsContext = () => React.useContext(ProjectTabsContext);

export const ProjectTabsContextProvider: React.FC = ({ children }) => {
  const { tab = "0" } = useCustomRoute();
  const [projectTabIndex, setProjectTabIndex] = React.useState<PROJECT_TAB>(
    parseInt(tab)
  );

  return (
    <ProjectTabsContext.Provider
      value={{
        projectTabIndex,
        setProjectTabIndex,
      }}
    >
      {children}
    </ProjectTabsContext.Provider>
  );
};
