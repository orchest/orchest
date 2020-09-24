import React from 'react';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';

export default class Login extends React.Component {
    render() {
        return (
            <div className="login-form">
                <div className="box">
                    <img src="static/image/logo.png" className="logo" />
                    <form method="post" action="">
                        <MDCTextFieldReact label="Username" name="username" /><br />
                        <MDCTextFieldReact label="Password" password name="password" /><br />
                        <MDCButtonReact classNames={["mdc-button--raised"]} label="Login" />
                    </form>
                </div>
            </div>
        )
    }
}