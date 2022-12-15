import theme from "@/theme";
import { ThemeProvider } from "@mui/material/styles";
import { DesignSystemProvider } from "@orchest/design-system";
import { domMax, LazyMotion } from "framer-motion";
import React from "react";
import { GlobalContextProvider } from "./GlobalContext";
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
 * - SessionsContext: handling sessions for the user
 * - ProjectContext: managing the active project
 */
export const OrchestProvider: React.FC = ({ children }) => {
  return (
    <ProjectsContextProvider>
      <SessionsContextProvider>{children}</SessionsContextProvider>
    </ProjectsContextProvider>
  );
};

export const GlobalProviders: React.FC = ({ children }) => {
  return (
    <DesignProvider>
      <GlobalContextProvider>
        <Intercom>{children}</Intercom>
      </GlobalContextProvider>
    </DesignProvider>
  );
};
