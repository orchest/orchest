import React from 'react';

class SettingsView extends React.Component {
  componentWillUnmount() {
  }
  render() {
    return <div className={"view-page"}>
      <h2>Global settings</h2>
      <i>No global settings to be configured yet.</i>
    </div>;
  }
}

export default SettingsView;