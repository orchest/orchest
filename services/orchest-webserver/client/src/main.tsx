import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { makeRequest } from "@orchest/lib-utils";
import "./styles/main.scss";

import { OrchestProvider } from "@/lib/orchest";
import type { IOrchestProviderProps } from "@/lib/orchest/types";

declare global {
  interface Document {
    fonts: any;
  }
}

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    makeRequest("GET", "/async/server-config").then((result: string) => {
      const serverConfig = JSON.parse(result) as IOrchestProviderProps;

      ReactDOM.render(
        <React.StrictMode>
          <OrchestProvider {...serverConfig}>
            <App />
          </OrchestProvider>
        </React.StrictMode>,
        document.querySelector("#root")
      );
    });
  });
});
