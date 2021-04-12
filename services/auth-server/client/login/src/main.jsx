import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "./styles/main.scss";

// Get path components
let queryArgs = new URLSearchParams(location.search);
let view = queryArgs.has("view") ? queryArgs.get("view") : "";
let reactRoot = document.getElementById("root");

ReactDOM.render(<App view={view} />, reactRoot);
