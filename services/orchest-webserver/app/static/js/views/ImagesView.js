import React, { Fragment } from 'react';
import { makeRequest, makeCancelable, PromiseManager, RefManager } from '../lib/utils/all';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import MDCCheckboxReact from '../lib/mdc-components/MDCCheckboxReact';
import CommitsView from './CommitsView';
import MDCIconButtonToggleReact from '../lib/mdc-components/MDCIconButtonToggleReact';
import MDCDialogReact from '../lib/mdc-components/MDCDialogReact';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import MDCSelectReact from '../lib/mdc-components/MDCSelectReact';
import MDCDataTableReact from '../lib/mdc-components/MDCDataTableReact';

class ImagesView extends React.Component {

  constructor(props){
    super(props);

    this.state = {
      images: undefined,
      gpuDocsNotice: false,
    }

    this.LANGUAGE_MAP = {
      "python": "Python 3",
      "r": "R"
    }
    
    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
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
        let images = JSON.parse(result);

        this.setState({
          "images": images,
          "listData": this.processListData(images)
        })
        
      } catch (error) {
        console.log(error);
        console.log("Error parsing JSON response: ", result);
      }
      
    }).catch((err) => {
      console.log("Error fetching Images", err);
    })

  }

  onClickListItem(row, idx, e){
    let image = this.state.images[idx];
    orchest.loadView(CommitsView, {image: image});
  }

  onCreateClick(){
    this.setState({
      addModal: true
    })
  }

  onDeleteClick(){
    let selectedIndices = this.refManager.refs.imageListView.getSelectedRowIndices();

    if(selectedIndices.length === 0){
        orchest.alert("Error", "You haven't selected any images.")
        return;
    }

    orchest.confirm("Warning", "Are you certain that you want to delete this image? It will also remove all associated commits. (This cannot be undone.)", () => {

        selectedIndices.forEach((idx) => {
            let image_uuid = this.state.images[idx].uuid;
            let image_name = this.state.images[idx].name;

            // fetch commits for image
            let commitsPromise = makeCancelable(makeRequest("GET", "/store/commits?image_name=" + encodeURIComponent(image_name)), this.promiseManager);
    
            commitsPromise.promise.then((result) => {
              
              try {
                let commits = JSON.parse(result);
                
                let promises = [];

                for(let commit of commits){

                  promises.push(makeRequest("DELETE", "/store/commits/" + commit.uuid));
            
                  Promise.all(promises).then(() => {

                    // ultimately remove Image
                    makeRequest("DELETE", "/store/images/" + image_uuid).then((_) => {
                      // reload list once removal succeeds
                      this.fetchImages();
        
                    }).catch((e) => {
                      let errorMessage = "unknown";
                      try {
                        errorMessage = JSON.parse(e.body).message;
                      } catch (e){
                        console.error(e);
                      }
                      orchest.alert("Deleting image '" + this.state.images[idx].name + "' failed. Reason: " + errorMessage);
                    })

                  });

                }
                
              } catch (error) {
                console.log(error);
                console.log("Error parsing JSON response: ", result);
              }
              
            }).catch((err) => {
              console.log("Error fetching commits", err);
            })

        });
    })
  }

  onCancelModal(){
    this.setState({
      addModal: false
    })
  }

  onSubmitModal(){
    let imageName = this.refManager.refs.addImageName.mdc.value;
    let imageLanguage = this.refManager.refs.addImageLanguage.mdc.value;
    let imageGPU = this.refManager.refs.addImageGPUSupport.mdc.value === "on";

    if(!imageName){
        orchest.alert("Error", "Please enter an image name.")
        return;
    }

    makeRequest("POST", "/store/images/new", {
        type: "json",
        content: {
          "name": imageName,
          "language": imageLanguage,
          "gpu_support": imageGPU
        }
    }).then((_) => {
        // reload list once creation succeeds
        this.fetchImages()
    })

    this.setState({
      addModal: false
    })
  }


  processListData(images){

    let listData = [];

    for(let image of images){
        listData.push([
            <span>{image.name}</span>,
            <span>{this.LANGUAGE_MAP[image.language]}</span>,
            <span>{image.gpu_support ? <i className="material-icons">done</i> : <i className="material-icons mdc-button__icon">clear</i> }</span>
        ]);
    }

    return listData
  }

  onGPUChange(e){
    if(e.target.checked === true){
      this.setState({
        "gpuDocsNotice": true
      })
    }else{
      this.setState({
        "gpuDocsNotice": false
      })
    }
  }

  render() {
    return <div className={"view-page"}>
      <h2>Images</h2>

      {(() => {
          if(this.state.addModal){
              return <MDCDialogReact title="Add a new image"
                  content={
                      <Fragment>
                        <MDCTextFieldReact ref={this.refManager.nrefs.addImageName} classNames={['fullwidth', 'push-down']} label="Image name" />
                        <MDCSelectReact value="python" label="Language" classNames={['fullwidth', 'push-down']}  ref={this.refManager.nrefs.addImageLanguage} options={[
                            ["python", this.LANGUAGE_MAP["python"]],
                            ["r", this.LANGUAGE_MAP["r"]]
                          ]}
                        />
                        <MDCCheckboxReact onChange={this.onGPUChange.bind(this)} label="GPU support" ref={this.refManager.nrefs.addImageGPUSupport} />
                        {(() => {
                          if(this.state.gpuDocsNotice === true){
                            return <div className="docs-notice push-up">
                              Check out <a target="_blank" href={orchest.config['DOCS_ROOT'] + "/en/latest/installation.html"}>the documentation</a> to make sure Orchest is properly configured for images with GPU support.
                            </div>
                          }
                        })()}
                      </Fragment>
              } actions={
                  <Fragment>
                      <MDCButtonReact icon="device_hub" classNames={["mdc-button--raised", "themed-secondary"]} label="Add image" onClick={this.onSubmitModal.bind(this)} />
                      <MDCButtonReact icon="close" label="Cancel" classNames={["push-left"]} onClick={this.onCancelModal.bind(this)} />
                  </Fragment>
              } />
          }
      })() }

      {(() => {
        if(this.state.images){
          return <Fragment>
              <div className={"image-actions push-down"}>
                    <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                    <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                </div>

                <MDCDataTableReact ref={this.refManager.nrefs.imageListView} selectable onRowClick={this.onClickListItem.bind(this)} classNames={['fullwidth']} headers={["Image", "Language" ,"GPU Support"]} rows={this.state.listData}  />
            </Fragment>
        }else{
          return <MDCLinearProgressReact />
        }
      })()}
      
    </div>;
  }
}

export default ImagesView;