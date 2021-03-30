import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import $ from "jquery";
import "./utils/overflowing";
window.$ = $;

// Load after fonts are ready, required by MDC
window.addEventListener("load", () => {
  document.fonts.ready.then(() => {
    ReactDOM.render(<App />, document.querySelector("#react-root"));
  });
})

