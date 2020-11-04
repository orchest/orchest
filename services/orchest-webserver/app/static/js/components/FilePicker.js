import React from "react";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import { RefManager } from "../lib/utils/all";

class FilePicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      focused: false,
      path: props.cwd ? props.cwd : '/',
      value: props.value,
    }

    this.refManager = new RefManager();

  }

  directoryListFromNode(node) {
    let nodes = [];

    // handle edge case of no nodes
    if (!node.children) {
      return nodes;
    }

    // add create file and move up directory
    nodes.push(<li key="create" className="mdc-list-item" onClick={this.onCreateFile.bind(this)}>New file <i className="material-icons">add</i></li>);
    
    if(node.root !== true){
      nodes.push(<li key=".." className="mdc-list-item" onClick={this.onNavigateUp.bind(this)}>..</li>);
    }

    for (let childNode of node.children) {
      nodes.push(<li key={childNode.name} className="mdc-list-item" onClick={this.onSelectListItem.bind(this, childNode)}>{childNode.name + (childNode.type == "directory" ? "/" : "")}</li>);
    }

    return nodes;
  }

  onCreateFile(){
    if(this.props.onCreateFile){
      this.props.onCreateFile(this.state.path);
    }
  }

  onNavigateUp(){
    this.setState((state, _) => {
      let newPath = state.path.slice(0, state.path.slice(0, -1).lastIndexOf("/") + 1);
      
      return {
        path: newPath,
        value: this.visualizePath(newPath, this.props.cwd)
      }
    })
  }

  visualizePath(path, cwd){

    // to simplify algorithm, path always end with a '/' (also for files)
    let isFile = !path.endsWith("/");
    if(isFile){
      path = path + "/";
    }

    let visualPath;
    
    if(cwd === undefined){
      visualPath = path.slice(1);
    }else{
      // path in cwd or outside
      if(path.startsWith(cwd)){
        visualPath = path.slice(cwd.length);
      }else{
        // get components /abc/def/ -> [abc, def]
        let cwdC = cwd.split("/").slice(1,-1);
        let pathC = path.split("/").slice(1, -1);

        let relativePrefixCount = 0;
        for(let x = 0; x < cwdC.length; x++){
          if(cwdC[x] != pathC[x]){
            relativePrefixCount = cwdC.length - x;
            break;
          }
        }

        visualPath = "../".repeat(relativePrefixCount) + pathC.slice(relativePrefixCount - 1).map((el) => { return el + "/"}).join("")
      }
    }

    // remove appended slash
    if(isFile){
      visualPath = visualPath.slice(0, -1);
    }

    return visualPath;
  }


  onSelectListItem(node){
    // override focus on list item click
    if(node.type == "directory"){
      this.setState((state, _) => {
        let newPath = state.path + node.name + "/";
        return {
          path: newPath,
          value: this.visualizePath(newPath, this.props.cwd)
        }
      })
    }else{
      this.setState((state, _) => {
        return {
          value: this.visualizePath(state.path + node.name, this.props.cwd),
          focused: false,
        }
      })
    }
  }

  nodeFromPath(path, tree) {

    // a path should always start with a root of "/"
    let pathComponents = path.split("/").slice(1);
    let currentNode = tree;

    // traverse to the right directory node
    for (let component of pathComponents) {
      for (let child of currentNode.children) {
        if (child.name == component) {
          currentNode = child;
          break;
        }
      }
    }

    return currentNode;
  }

  onBlurMenu(e){
    this.setState({
      focused: false
    })
  }
  
  onFocusTextField(e){
    this.setState({
      focused: true
    })
  }

  onBlurTextField(e){

    setTimeout(() => {
      if(document.activeElement !== this.refManager.refs.fileMenu){
        this.setState({
          focused: false
        })
      }
    })
  }

  componentDidMount() {
  }

  render() {

    let directory_list = this.directoryListFromNode(this.nodeFromPath(this.state.path, this.props.tree));

    return (
      <div className="dropdown-file-picker">
        <MDCTextFieldReact 
          onFocus={this.onFocusTextField.bind(this)}
          onBlur={this.onBlurTextField.bind(this)}
          value={this.state.value}
          label="File path"
          ref={this.refManager.nrefs.filePathTextField}
        />
        {(() => {
          return <div ref={this.refManager.nrefs.fileMenu} onBlur={this.onBlurMenu.bind(this)} className={"mdc-menu mdc-menu-surface mdc-menu-surface--open " + (this.state.focused ? "" : "hidden")} tabIndex="0">
            <ul className="mdc-list">
              {directory_list}
            </ul>
          </div>
        })()}
      </div>
    );
  }
}

export default FilePicker;
