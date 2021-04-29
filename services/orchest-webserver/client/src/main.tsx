import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { makeRequest } from "@orchest/lib-utils";
import "./styles/main.scss";
import { OrchestProvider } from "./lib/orchest";

declare global {
  interface Document {
    fonts: any;
  }

  interface Window {
    /** Deprecated */
    orchest: any;
    /** Deprecated */
    ORCHEST_CONFIG: any;
    ORCHEST_USER_CONFIG: any;
  }
}

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    makeRequest("GET", "/async/server-config").then((result) => {
      let config = JSON.parse(result as string);
      window.ORCHEST_CONFIG = config.config;
      window.ORCHEST_USER_CONFIG = config.user_config;

      ReactDOM.render(
        <OrchestProvider {...config}>
          <App />
        </OrchestProvider>,
        document.querySelector("#root")
      );
    });
  });
});
