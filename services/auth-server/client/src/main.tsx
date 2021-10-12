import App from "./App";
import React from "react";
import ReactDOM from "react-dom";

// Get path components
const view = window.location.pathname;
const urlSearchParams = new URLSearchParams(window.location.search);
const queryArgs = urlSearchParams.toString();
let reactRoot = document.getElementById("root");

ReactDOM.render(
  // @ts-ignore
  <App view={view} queryArgs={queryArgs} />,
  reactRoot
);
