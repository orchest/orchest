import React, { Fragment } from 'react';
import CheckItemList from '../components/CheckItemList';
import { makeRequest, makeCancelable, PromiseManager } from '../lib/utils/all';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import MDCIconButtonToggleReact from '../lib/mdc-components/MDCIconButtonToggleReact';
import CommitEditView from './CommitEditView';

class CommitsView extends React.Component {

  constructor(props){
    super(props);

    this.state = {
      "commits": undefined,
    }
    
    this.promiseManager = new PromiseManager();
  }

  componentDidMount(){
    this.fetchCommits();
  }

  componentWillUnmount(){
    this.promiseManager.cancelCancelablePromises();
  }

  fetchCommits(){

    // fetch data sources
    let commitsPromise = makeCancelable(makeRequest("GET", "/store/commits?image_name=" + encodeURIComponent(this.props.image.name)), this.promiseManager);
    
    commitsPromise.promise.then((result) => {
      try {
        let json = JSON.parse(result);

        this.setState({
          "commits": json
        })
        
      } catch (error) {
        console.log(error);
        console.log("Error parsing JSON response: ", result);
      }
      
    }).catch((err) => {
      console.log("Error fetching Images", err);
    })

  }

  onDeleteClick(){

    let selectedIndices = this.refs.checkItemList.customSelectedIndex();

    orchest.confirm("Warning", "Are you sure you want to delete the selected commits? (This cannot be undone.)", () => {
      let promises = [];
      for(let x = 0; x < selectedIndices.length; x++){
        promises.push(makeRequest("DELETE", "/store/commits/" + this.state.commits[selectedIndices[x]].uuid));
      }

      Promise.all(promises).then(() => {
        this.fetchCommits();
      });
    })

  }

  onCreateClick(){

    orchest.loadView(CommitEditView, {image: this.props.image});
    
  }

  onClickListItem(commit, e){
    orchest.loadView(CommitEditView, {commit: commit, image: this.props.image});
  }

  render() {
    return <div className={"view-page"}>
      <h2>Commits for: {this.props.image.name}</h2>

      {(() => {
        if(this.state.commits){
          return <Fragment>
              <div className={"data-source-actions"}>
                <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
              </div>
              <CheckItemList ref="checkItemList" items={this.state.commits} onClickListItem={this.onClickListItem.bind(this)} />
            </Fragment>
        }else{
          return <MDCLinearProgressReact />
        }
      })()}
      
    </div>;
  }
}

export default CommitsView;