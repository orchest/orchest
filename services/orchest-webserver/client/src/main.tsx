import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { makeRequest } from "@orchest/lib-utils";
import "./styles/main.scss";
import { ConfigProvider } from "./hooks/config";

declare global {
  interface Document {
    fonts: any;
  }

  interface Window {
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

      console.log(config);

      ReactDOM.render(
        <React.StrictMode>
          <ConfigProvider {...config}>
            <App />
          </ConfigProvider>
        </React.StrictMode>,
        document.querySelector("#root")
      );
    });
  });
});
