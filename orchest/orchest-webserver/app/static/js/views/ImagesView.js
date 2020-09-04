import React, { Fragment } from 'react';
import { makeRequest, makeCancelable, PromiseManager } from '../lib/utils/all';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import CommitsView from './CommitsView';
import ItemList from '../components/ItemList';

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

  onClickListItem(image, e){
    orchest.loadView(CommitsView, {image: image});
  }

  render() {
    return <div className={"view-page"}>
      <h2>Images</h2>

      {(() => {
        if(this.state.images){
          return <Fragment>
              <ItemList ref="itemList" items={this.state.images} onClickListItem={this.onClickListItem.bind(this)} />
            </Fragment>
        }else{
          return <MDCLinearProgressReact />
        }
      })()}
      
    </div>;
  }
}

export default ImagesView;