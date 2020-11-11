import React from "react";

class ManageUsersView extends React.Component {

  constructor() {
    super();
  }

  render() {
    return (
      <div className={"view-page no-padding manage-users"}>
        <iframe className="borderless fullsize" src="/login/admin" />
      </div>
    );
  }
}

export default ManageUsersView;
