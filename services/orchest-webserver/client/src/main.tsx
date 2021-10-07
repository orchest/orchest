import { LazyMotion, domMax } from "framer-motion";

import App from "./App";
import { DesignSystemProvider } from "@orchest/design-system";
import { OrchestProvider } from "./hooks/orchest";
// @ts-check
import React from "react";
import ReactDOM from "react-dom";
import { getCssString } from "@orchest/design-system";
import { makeRequest } from "@orchest/lib-utils";

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

// Load Stitches CSS
let style = document.createElement("style");
style.innerHTML = getCssString();
window.document.head.appendChild(style);

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    makeRequest("GET", "/async/server-config")
      .then((result) => {
        let config = JSON.parse(result as string);

        ReactDOM.render(
          <LazyMotion features={domMax}>
            <DesignSystemProvider>
              <OrchestProvider {...config}>
                <App />
              </OrchestProvider>
            </DesignSystemProvider>
          </LazyMotion>,
          document.querySelector("#root")
        );
      })
      .catch((e) => console.log(e));
  });
});
