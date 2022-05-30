import theme from "@/theme";
import { ThemeProvider } from "@mui/material/styles";
import { DesignSystemProvider } from "@orchest/design-system";
import { domMax, LazyMotion } from "framer-motion";
import React from "react";
import { AppContextProvider } from "./AppContext";
import { Intercom } from "./Intercom";
import { ProjectsContextProvider } from "./ProjectsContext";
import { SessionsContextProvider } from "./SessionsContext";

/**
 * Providers for theme-related configurations
 */
export const DesignProvider: React.FC = ({ children }) => {
  return (
    <LazyMotion features={domMax}>
      <DesignSystemProvider>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </DesignSystemProvider>
    </LazyMotion>
  );
};

/**
 * Providers that are specific to Orchest core, outer provider represents higher-level logic
 * - AppContext: app config, top-level UI config
 * - SessionsContext: handling sessions for the user
 * - ProjectsContext: handling the logic for projects, pipelines, etc.
 */
export const OrchestProvider: React.FC = ({ children }) => {
  return (
    <AppContextProvider>
      <Intercom>
        <ProjectsContextProvider>
          <SessionsContextProvider>{children}</SessionsContextProvider>
        </ProjectsContextProvider>
      </Intercom>
    </AppContextProvider>
  );
};
