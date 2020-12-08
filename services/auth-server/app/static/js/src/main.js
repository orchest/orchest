import Admin from "./components/Admin";
import Login from "./components/Login";
import React from "react";
import ReactDOM from "react-dom";

let view = document.getElementById("app");

let viewName = view.attributes.getNamedItem("data-view").value;

switch (viewName) {
  case "Login":
    let loginFailedReason = document.querySelector("input[name='LOGIN_FAILED']")
      .value;
    ReactDOM.render(<Login loginFailedReason={loginFailedReason} />, view);
    break;
  case "Admin":
    ReactDOM.render(
      <Admin dataJSON={view.attributes.getNamedItem("data-json").value} />,
      view
    );
    break;
}
