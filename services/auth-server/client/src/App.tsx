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
    if (this.state.config) {
      switch (this.props.view) {
        case "/login":
          return (
            <Login
              cloud={this.state.config.CLOUD}
              cloudURL={this.state.config.CLOUD_URL}
              queryArgs={this.props.queryArgs}
            />
          );
        case "/login/admin":
          return <Admin />;
      }
    } else {
      console.log("The given view is not defined: " + this.props.view);
      return null;
    }
  }
}
