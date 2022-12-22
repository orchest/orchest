import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { AppProviders } from "./contexts/Providers";
import Jupyter from "./jupyter/Jupyter";

declare global {
  interface Document {
    fonts: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  interface WheelEvent {
    wheelDeltaY?: number;
  }

  interface Window {
    orchest: { jupyter: Jupyter | null };
    Intercom: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    _orchest_docmanager: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    _orchest_app: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

window.addEventListener("load", async () => {
  try {
    // Load after fonts are ready, required by MDC
    await document.fonts.ready;

    ReactDOM.render(
      <AppProviders>
        <GlobalStyles
          styles={{
            "html, body": { height: "100%" },
            ".Mui-disabled, *[disabled]": {
              cursor: "not-allowed",
            },
          }}
        />
        <CssBaseline />
        <App />
      </AppProviders>,
      document.querySelector("#root")
    );
  } catch (error) {
    console.error(error);
  }
});
