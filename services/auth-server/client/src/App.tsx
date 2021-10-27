// @ts-nocheck
import { makeRequest } from "@orchest/lib-utils";
import * as React from "react";
import Admin from "./views/Admin";
import Login from "./views/Login";

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
              githubURL={this.state.config.GITHUB_URL}
              documentationURL={this.state.config.DOCUMENTATION_URL}
              videosURL={this.state.config.VIDEOS_URL}
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
