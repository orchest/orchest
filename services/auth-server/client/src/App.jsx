import Admin from "./views/Admin";
import Login from "./views/Login";

import { makeRequest } from "@orchest/lib-utils";

import React from "react";

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
        case "":
          return (
            <Login
              cloud={this.state.config.cloud}
              cloudURL={this.state.config.cloudURL}
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
