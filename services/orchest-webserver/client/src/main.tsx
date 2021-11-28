import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { DesignProvider, OrchestProvider } from "./contexts/Providers";

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
      <DesignProvider>
        <OrchestProvider>
          <App />
        </OrchestProvider>
      </DesignProvider>,
      document.querySelector("#root")
    );
  } catch (error) {
    console.error(error);
  }
});
