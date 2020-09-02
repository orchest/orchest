import React, { Fragment } from 'react';
import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import DataSourceEditView from "./DataSourceEditView";
import CheckItemList from '../components/CheckItemList';
import { makeRequest, makeCancelable, PromiseManager } from '../lib/utils/all';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';

class DataSourcesView extends React.Component {

  constructor(props){
    super(props);

    this.state = {
      "datasources": undefined,
    }
    
    this.promiseManager = new PromiseManager();
  }

  componentDidMount(){

    this.fetchDataSources();

  }

  componentWillUnmount(){
    this.promiseManager.cancelCancelablePromises();
  }

  fetchDataSources(){

    // in case checkItemList exists, clear checks
    if(this.refs.checkItemList){
      this.refs.checkItemList.deselectAll();
    }

    // fetch data sources
    let datasourcesPromise = makeCancelable(makeRequest("GET", "/store/datasources"), this.promiseManager);
    
    datasourcesPromise.promise.then((result) => {
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
    })

  }

  onCreateClick(){

    orchest.loadView(DataSourceEditView);

  }

  onDeleteClick(){

    // select indices

    let selectedIndices = this.refs.checkItemList.customSelectedIndex();

    orchest.confirm("Warning", "Are you sure you want to delete the selected data sources? (This cannot be undone.)", () => {
      let promises = [];
      for(let x = 0; x < selectedIndices.length; x++){
        promises.push(makeRequest("DELETE", "/store/datasources/" + this.state.dataSources[selectedIndices[x]].name));
      }

      Promise.all(promises).then(() => {
        this.fetchDataSources();
      });
    })

  }

  onClickListItem(dataSource, e){
    orchest.loadView(DataSourceEditView, {"dataSource": dataSource});
  }

  render() {
    return <div className={"view-page"}>
      <h2>Data sources</h2>

      {(() => {
        if(this.state.dataSources){
          return <Fragment>
              <div className={"data-source-actions"}>
                <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
              </div>
              <CheckItemList ref="checkItemList" items={this.state.dataSources} onClickListItem={this.onClickListItem.bind(this)} />
            </Fragment>
        }else{
          return <MDCLinearProgressReact />
        }
      })()}
      
    </div>;
  }
}

export default DataSourcesView;