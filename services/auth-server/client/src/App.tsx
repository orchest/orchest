// @ts-nocheck
import Admin from "./views/Admin";
import Login from "./views/Login";

import { makeRequest } from "@orchest/lib-utils";

import * as React from "react";

export default class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      config: undefined,
    };
  }

  componentDidMount() {
    makeRequest("GET", "/login/server-config").then((result) => {
      let config = JSON.parse(result);
      this.setState({
        config,
      });
    });
  }

  render() {
    const view = window.location.pathname.split("/")[1];
    const urlSearchParams = new URLSearchParams(window.location.search);
    const queryArgs = urlSearchParams.toString();

    if (this.state.config) {
      switch (view) {
        case "login":
          return (
            <Login
              cloud={this.state.config.CLOUD}
              cloudURL={this.state.config.CLOUD_URL}
              queryArgs={queryArgs}
            />
          );
        case "admin":
          return <Admin />;
      }
    } else {
      return null;
    }
  }
}
