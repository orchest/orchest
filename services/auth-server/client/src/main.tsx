import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./styles/main.scss";

// Get path components
let view = window.location.href.split("/").slice(-1)[0];
let reactRoot = document.getElementById("root");

ReactDOM.render(
  // @ts-ignore
  <App view={view} />,
  reactRoot
);
