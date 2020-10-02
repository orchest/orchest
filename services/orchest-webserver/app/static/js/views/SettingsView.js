import React from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import UpdateView from './UpdateView';

class SettingsView extends React.Component {
  componentWillUnmount() {
  }

  updateView(){
    orchest.loadView(UpdateView);
  }

  render() {
    return <div className={"view-page"}>
      <h2>Global settings</h2>
      <p className="push-down"><i>No global settings to be configured yet.</i></p>

      <h2>Updates</h2>
      <MDCButtonReact label="Check for updates" icon="system_update_alt" onClick={this.updateView.bind(this)} />
    </div>;
  }
}

export default SettingsView;