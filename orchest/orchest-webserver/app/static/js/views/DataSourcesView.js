import React from 'react';
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";
import DataSourceEditView from "./DataSourceEditView";
import CheckItemList from '../components/CheckItemList';
import { makeRequest } from '../utils/all';

class DataSourcesView extends React.Component {

  constructor(props){
    super(props);

    this.state = {
      "datasources": undefined,
    }
  }

  componentDidMount(){

    // fetch data sources
    makeRequest("GET", "/store/datasources").then((result) => {
      try {
        let json = JSON.parse(result);

        this.setState({
          "dataSources": json
        })
      } catch (error) {
        console.log(error);
        console.log("Error parsing JSON response: ", result);
      }
      
    }).catch((err) => {
      console.log("Error fetching DataSources", err);
    });

  }

  onCreateClick(){

    orchest.loadView(DataSourceEditView);

  }

  onDeleteClick(){

    console.log("Stub: deleting...");
    console.log(this.refs.checkItemList.customSelectedIndex())

  }

  onClickListItem(dataSource){
    orchest.loadView(DataSourceEditView, {"dataSource": dataSource});
  }

  render() {
    return <div className={"view-page"}>
      <h2>Configured data sources</h2>
      <div className={"data-source-actions"}>
        <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
        <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
      </div>

      {(() => {
        if(this.state.dataSources){
          return <CheckItemList ref="checkItemList" items={this.state.dataSources} onClickListItem={this.onClickListItem.bind(this)} />
        }
      })()}
      
    </div>;
  }
}

export default DataSourcesView;