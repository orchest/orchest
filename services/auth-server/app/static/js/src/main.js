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
    let cloud = document.querySelector("input[name='CLOUD']").value === "true";
    let cloudURL = document.querySelector("input[name='CLOUD_URL']").value;

    ReactDOM.render(
      <Login
        cloud={cloud}
        cloudURL={cloudURL}
        loginFailedReason={loginFailedReason}
      />,
      view
    );
    break;
  case "Admin":
    ReactDOM.render(
      <Admin dataJSON={view.attributes.getNamedItem("data-json").value} />,
      view
    );
    break;
}
