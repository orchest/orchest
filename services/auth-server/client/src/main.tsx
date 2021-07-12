import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./styles/main.scss";

// Get path components
let reactRoot = document.getElementById("root");

ReactDOM.render(
  // @ts-ignore
  <App />,
  reactRoot
);
