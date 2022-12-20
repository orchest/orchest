import { useFetchOrchestConfigs } from "@/hooks/useFetchOrchestConfigs";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import theme from "@/theme";
import { ThemeProvider } from "@mui/material/styles";
import { DesignSystemProvider } from "@orchest/design-system";
import { domMax, LazyMotion } from "framer-motion";
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { AppContextProvider } from "./AppContext";
import { GlobalContextProvider, useGlobalContext } from "./GlobalContext";
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

export const GlobalProviders: React.FC = ({ children }) => {
  return (
    <GlobalContextProvider>
      <Intercom>{children}</Intercom>
    </GlobalContextProvider>
  );
};

/**
 * Providers that are specific to Orchest core, outer provider represents higher-level logic
 * - SessionsContext: handling sessions for the user
 * - ProjectContext: managing the active project
 */
export const OrchestProvider: React.FC = ({ children }) => {
  useFetchOrchestConfigs();
  return (
    <ProjectsContextProvider>
      <SessionsContextProvider>{children}</SessionsContextProvider>
    </ProjectsContextProvider>
  );
};

/**
 * Sets up the router and a "unsaved changes" handler.
 * Requires `GlobalContext`.
 */
export const RouteProvider: React.FC = ({ children }) => {
  const { setAsSaved, setConfirm } = useGlobalContext();
  const discardActiveCronJobChanges = useEditJob(
    (state) => state.discardActiveCronJobChanges
  );

  return (
    <Router
      getUserConfirmation={(message, callback) => {
        // use Prompt component to intercept route changes
        // handle the blocking event here
        if (message === "hasUnsavedChanges") {
          setConfirm(
            "Warning",
            "There are unsaved changes. Are you sure you want to navigate away?",
            async (resolve) => {
              setAsSaved();
              discardActiveCronJobChanges();
              callback(true);
              resolve(true);
              return true;
            }
          );
        }
      }}
    >
      {children}
    </Router>
  );
};

export const AppProviders: React.FC = ({ children }) => {
  return (
    <DesignProvider>
      <GlobalProviders>
        <RouteProvider>
          <OrchestProvider>
            <AppContextProvider>{children}</AppContextProvider>
          </OrchestProvider>
        </RouteProvider>
      </GlobalProviders>
    </DesignProvider>
  );
};
