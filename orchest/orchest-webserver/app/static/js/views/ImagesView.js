import React, { Fragment } from 'react';
import CheckItemList from '../components/CheckItemList';
import { makeRequest, makeCancelable, PromiseManager } from '../lib/utils/all';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';

class ImagesView extends React.Component {

  constructor(props){
    super(props);

    this.state = {
      "images": undefined,
    }
    
    this.promiseManager = new PromiseManager();
  }

  componentDidMount(){
    this.fetchImages();
  }

  componentWillUnmount(){
    this.promiseManager.cancelCancelablePromises();
  }

  fetchImages(){

    // fetch data sources
    let imagesPromise = makeCancelable(makeRequest("GET", "/store/images"), this.promiseManager);
    
    imagesPromise.promise.then((result) => {
      try {
        let json = JSON.parse(result);

        this.setState({
          "images": json
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

    orchest.confirm("Warning", "Are you sure you want to delete the selected images? (This cannot be undone.)", () => {
      let promises = [];
      for(let x = 0; x < selectedIndices.length; x++){
        promises.push(makeRequest("DELETE", "/store/images/" + this.state.images[selectedIndices[x]].name));
      }

      Promise.all(promises).then(() => {
        this.fetchImages();
      });
    })

  }

  onClickListItem(image, e){
    orchest.loadView(CommitsView, {image: image});
  }

  render() {
    return <div className={"view-page"}>
      <h2>Images</h2>

      {(() => {
        if(this.state.images){
          return <Fragment>
              <CheckItemList ref="checkItemList" items={this.state.images} onClickListItem={this.onClickListItem.bind(this)} />
            </Fragment>
        }else{
          return <MDCLinearProgressReact />
        }
      })()}
      
    </div>;
  }
}

export default ImagesView;