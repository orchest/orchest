// @ts-nocheck
import * as React from "react";
import { MDCTextFieldReact, MDCButtonReact } from "@orchest/lib-mdc";
import { makeRequest } from "@orchest/lib-utils";

export default class Login extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loginFailure: undefined,
      username: "",
      password: "",
    };
  }

  submitLogin(e) {
    e.preventDefault();

    let formData = new FormData();
    formData.append("username", this.state.username);
    formData.append("password", this.state.password);

    let queryString = this.props.queryArgs ? "?" + this.props.queryArgs : "";
    makeRequest("POST", "/login/submit" + queryString, {
      type: "FormData",
      content: formData,
    })
      .then((response) => {
        let result = JSON.parse(response);
        if (result.redirect) {
          window.location.href = result.redirect;
        }
      })
      .catch((response) => {
        let result = JSON.parse(response.body);
        this.setState({
          loginFailure: result.error,
        });
      });
  }

  handleInput(key, value) {
    let data = {};
    data[key] = value;
    this.setState(data);
  }

  render() {
    return (
      <div className="login-form">
        <div className="box">
          <img src="image/logo.png" className="logo" />
          <form method="post" onSubmit={this.submitLogin.bind(this)}>
            <MDCTextFieldReact
              label="Username"
              value={this.state.username}
              onChange={this.handleInput.bind(this, "username")}
              name="username"
            />
            <br />
            <MDCTextFieldReact
              label="Password"
              value={this.state.password}
              onChange={this.handleInput.bind(this, "password")}
              inputType="password"
              name="password"
            />
            <br />
            <MDCButtonReact
              submitButton
              classNames={["mdc-button--raised"]}
              label="Login"
            />
            {(() => {
              if (this.state.loginFailure) {
                return (
                  <div className="error push-up">{this.state.loginFailure}</div>
                );
              }
            })()}
          </form>
          {this.props.cloud && (
            <div className="cloud-login-suggestion">
              You can also log in using the <br />
              <a href={this.props.cloudURL}>Orchest Cloud dashboard</a>.
            </div>
          )}
        </div>
      </div>
    );
  }
}
