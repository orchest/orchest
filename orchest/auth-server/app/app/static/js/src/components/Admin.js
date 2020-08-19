import React from 'react';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';

export default class Admin extends React.Component {
    render() {

        let data = JSON.parse(this.props.dataJSON);

        let userNodes = [];

        for(let user of data['users']){
            userNodes.push(<div>
                <form className="delete-user-form" method='post'>
                    <input type="hidden" name="delete_username" value={user.username}></input>
                    <span>{user.username}</span>
                    <MDCButtonReact label="Delete" />
                </form>
            </div>)
        }

        return (
            <div className="edit-users-form">
                <div className="group">
                    <form method="post" action="">
                        <h2>Add user</h2>
                        <MDCTextFieldReact label="Username" name="username" /><br />
                        <MDCTextFieldReact label="Password" password name="password" /><br />
                        <MDCButtonReact classNames={["mdc-button--raised"]} label="Add" />
                    </form>
                </div>
                <div className="group">
                    <h2>Remove users</h2>
                    {userNodes}
                </div>
            </div>
        )
    }
}