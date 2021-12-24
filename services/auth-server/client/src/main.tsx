import { ThemeProvider } from "@mui/material/styles";
import React from "react";
import ReactDOM from "react-dom";
import theme from "../theme";
import App from "./App";

// Get path components
const view = window.location.pathname;
const urlSearchParams = new URLSearchParams(window.location.search);
const queryArgs = urlSearchParams.toString();
let reactRoot = document.getElementById("root");

ReactDOM.render(
  <ThemeProvider theme={theme}>
    <App view={view} queryArgs={queryArgs} />
  </ThemeProvider>,
  reactRoot
);
