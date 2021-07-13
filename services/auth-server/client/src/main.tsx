import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./styles/main.scss";

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
