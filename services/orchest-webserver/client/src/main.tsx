import theme from "@/theme";
import { ThemeProvider } from "@mui/material/styles";
import { DesignSystemProvider } from "@orchest/design-system";
import { domMax, LazyMotion } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { AppContextProvider } from "./contexts/AppContext";
import { SessionsContextProvider } from "./contexts/SessionsContext";
import { OrchestProvider } from "./hooks/orchest";

declare global {
  interface Document {
    fonts: any;
  }

  interface Window {
    /** @deprecated please don't use jQuery */
    $: any;
    orchest: any;
    Intercom: any;
  }
}

window.addEventListener("load", async () => {
  try {
    // Load after fonts are ready, required by MDC
    await document.fonts.ready;

    ReactDOM.render(
      <AppContextProvider>
        <LazyMotion features={domMax}>
          <DesignSystemProvider>
            <ThemeProvider theme={theme}>
              <OrchestProvider>
                <SessionsContextProvider>
                  <App />
                </SessionsContextProvider>
              </OrchestProvider>
            </ThemeProvider>
          </DesignSystemProvider>
        </LazyMotion>
      </AppContextProvider>,
      document.querySelector("#root")
    );
  } catch (error) {
    console.error(error);
  }
});
