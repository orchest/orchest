import React from 'react';

import PipelineView from "./PipelineView";
import MDCIconButtonToggleReact from "../mdc-components/MDCIconButtonToggleReact";

class PipelineListItem extends React.Component {

    checkboxClick(e){
        e.stopPropagation();
    }
    checkboxChange(e){
        this.setState({checked: !this.state.checked});
    }

    pipelineClick(){
        // load pipeline view
        orchest.loadView(PipelineView, {"uuid": this.props.pipeline.uuid})
    }

    getChecked(){
        // alert("getChecked called");
        return this.state.checked;
    }

    constructor(props) {
        super(props);

        this.state = {
            checked: false
        }
    }

    shouldComponentUpdate(nextProps, nextState, nextContext) {
        if(this.state.checked){
            this.setState({checked: false});
        }
        return true;
    }

    render() {
        return <li onClick={this.pipelineClick.bind(this) } className="mdc-list-item" data-pipeline-id={this.props.pipeline.id} role="checkbox" aria-checked="false">
          <span className="mdc-list-item__graphic">
            <div className="mdc-checkbox" >
              <input type="checkbox" onClick={this.checkboxClick.bind(this)} onChange={this.checkboxChange.bind(this)} checked={this.getChecked() ? "checked": false}
                     className="mdc-checkbox__native-control"
                     id="demo-list-checkbox-item-1"/>
              <div className="mdc-checkbox__background">
                <svg className="mdc-checkbox__checkmark"
                     viewBox="0 0 24 24">
                  <path className="mdc-checkbox__checkmark-path"
                        fill="none"
                        d="M1.73,12.91 8.1,19.28 22.79,4.59"/>
                </svg>
                <div className="mdc-checkbox__mixedmark"></div>
              </div>
            </div>
          </span>
            <label className="mdc-list-item__text" htmlFor="demo-list-checkbox-item-1">{this.props.pipeline.name}</label>
        </li>;
    }
}

class PipelinesListView extends React.Component {

    componentDidMount() {
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

    }

    customSelectedIndex(){
        let selected = [];

        for(let x = 0; x < this.props.listData.length; x++){
            if(this.refs["listItem"+x].getChecked()){
                selected.push(x);
            }
        }

        return selected
    }

    render() {

        this.listItems = this.props.listData.map((item, key) => (
            <PipelineListItem pipeline={item} ref={"listItem" + key} key={key} />
        ));

        return <ul className="mdc-list" ref={"mdcList"} role="group" aria-label="List with checkbox items">
            {this.listItems}
        </ul>
    }

}

class PipelinesView extends React.Component {

    componentWillUnmount() {

    }

    constructor(props) {
        super(props);

        this.state = {
            loaded: false
        }
    }

    componentDidMount() {

        this.fetchList();
    }

    fetchList(){
        // initialize REST call for pipelines
        fetch('async/pipelines').then((response) => {
            response.json().then((data) => {
                this.setState({loaded: true, listData: data.result})
            })
        })
    }

    onDeleteClick(){

        let selectedIndex = this.refs.pipelineListView.customSelectedIndex();
        
        if(selectedIndex.length === 0){
            alert("You haven't selected a pipeline.")
            return;
        }

        if(confirm("Are you certain that you want to delete this pipeline? Note: this action is irreversible.")){

            selectedIndex.forEach((item, index) => {
                let pipeline_id = this.state.listData[item].id;

                fetch("async/pipelines/delete/" + pipeline_id, {method: "POST"}).then((response) => {
                    // reload list once removal succeeds
                    this.fetchList();

                })
            });
        }
    }

    onCreateClick(){
        let pipelineName = prompt("Enter a pipeline name");

        if(!pipelineName){
            alert("Please enter a name.")
            return;
        }

        let data = new FormData();
        data.append("name", pipelineName);

        fetch("async/pipelines/create", {
            method: "POST",
            body: data
        }).then((response) => {
            // reload list once removal succeeds
            this.fetchList()
        })
    }

    onForkClick(){
        alert("Forking is not yet supported.")
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }


    render() {
        if(this.state.loaded){
            return <div className={"view-page"}>
                <h2>Pipelines</h2>
                <div className={"pipeline-actions"}>
                    <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                    <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                    <MDCIconButtonToggleReact icon="call_split" onClick={this.onForkClick.bind(this)} />
                </div>
                <PipelinesListView ref={"pipelineListView"} listData={this.state.listData} />
            </div>;
        }else{
            return <div className={"view-page"}>
                <h2>Pipelines</h2>
                <p>Loading...</p>
            </div>;
        }

    }
}

export default PipelinesView;