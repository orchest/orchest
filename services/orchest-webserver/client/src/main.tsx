import theme from "@/theme";
import { ThemeProvider } from "@mui/material/styles";
import { DesignSystemProvider } from "@orchest/design-system";
import { makeRequest } from "@orchest/lib-utils";
import { domMax, LazyMotion } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom";
import { IntercomProvider } from "react-use-intercom";
import App from "./App";
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

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    makeRequest("GET", "/async/server-config")
      .then((result) => {
        let serverConfig = JSON.parse(result as string);

        ReactDOM.render(
          <LazyMotion features={domMax}>
            <DesignSystemProvider>
              <IntercomProvider appId={serverConfig.config.INTERCOM_APP_ID}>
                <ThemeProvider theme={theme}>
                  <OrchestProvider {...serverConfig}>
                    <App />
                  </OrchestProvider>
                </ThemeProvider>
              </IntercomProvider>
            </DesignSystemProvider>
          </LazyMotion>,
          document.querySelector("#root")
        );
      })
      .catch((e) => console.log(e));
  });
});
