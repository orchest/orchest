import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { makeRequest } from "@orchest/lib-utils";
import "./styles/main.scss";

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    makeRequest("GET", "/async/server-config").then((result) => {
      let config = JSON.parse(result);
      window.ORCHEST_CONFIG = config.config;
      window.ORCHEST_USER_CONFIG = config.user_config;

      ReactDOM.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
        document.querySelector("#root")
      );
    });
  });
});
