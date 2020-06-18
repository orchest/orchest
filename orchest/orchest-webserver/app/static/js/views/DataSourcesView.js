import React from 'react';
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import DataSourceEditView from "../views/DataSourceEditView";

class DataSourcesView extends React.Component {

  componentWillUnmount() {

  }

  onCreateClick(){

    orchest.loadView(DataSourceEditView);

  }

  onDeleteClick(){

  }

  render() {
    return <div className={"view-page"}>
      <h2>Configured data sources</h2>
      <div className={"data-source-actions"}>
        <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
        <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
      </div>
    </div>;
  }
}

export default DataSourcesView;