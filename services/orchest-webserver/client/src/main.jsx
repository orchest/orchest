import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./styles/main.scss";

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    ReactDOM.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
      document.querySelector("#root")
    );
  });
});
