import React from 'react';

import {MDCList} from '@material/list';
import {MDCIconButtonToggle} from '@material/icon-button';
import PipelineView from "./PipelineView";

class PipelineListItem extends React.Component {

    checkboxClick(e){
        e.stopPropagation();
    }
    checkboxChange(e){
        this.setState({checked: !this.state.checked});
    }

    pipelineClick(){
        // load pipeline view
        databoost.loadView(PipelineView, {"name": this.props.name})
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
        return <li onClick={this.pipelineClick.bind(this) } className="mdc-list-item" data-pipeline-id={this.props.pipeline_id} role="checkbox" aria-checked="false">
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
            <label className="mdc-list-item__text" htmlFor="demo-list-checkbox-item-1">{this.props.name}</label>
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
            <PipelineListItem name={ item.name } ref={"listItem" + key} pipeline_id={item.id} key={key} />
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
        fetch('async/pipelines/get').then((response) => {
            response.json().then((data) => {
                this.setState({loaded: true, listData: data.result})
            })
        })
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

        if(this.state.loaded){

            if(!this.removeButton){

                // listeners for the MDCButtons in the pipeline actions bar
                this.removeButton = new MDCIconButtonToggle(this.refs.removeButton);
                this.removeButton.listen("MDCIconButtonToggle:change", (e) => {
                    if(confirm("Are you certain that you want to delete this pipeline? Note: this action is irreversible.")){

                        let selectedIndex = this.refs.pipelineListView.customSelectedIndex();

                        if(selectedIndex.length === 0){
                            alert("You haven't selected a pipeline.")
                        }
                        else{

                            selectedIndex.forEach((item, index) => {
                                let pipeline_id = this.state.listData[item].id;

                                fetch("async/pipelines/delete/" + pipeline_id, {method: "POST"}).then((response) => {
                                    // reload list once removal succeeds
                                    this.fetchList();

                                })
                            });


                        }
                    }
                });

                // listeners for the MDCButtons in the pipeline actions bar
                this.createButton = new MDCIconButtonToggle(this.refs.createButton);
                this.createButton.listen("MDCIconButtonToggle:change", (e) => {

                    let pipelineName = prompt("Enter a pipeline name");

                    let data = new FormData();
                    data.append("name", pipelineName);

                    fetch("async/pipelines/create", {
                        method: "POST",
                        body: data
                    }).then((response) => {
                        // reload list once removal succeeds
                        this.fetchList()
                    })
                })

            }

        }
    }



    render() {

        if(this.state.loaded){

            return <div className={"view-page"}>
                <h2>Pipelines</h2>
                <div className={"pipeline-actions"}>
                    <button ref={"createButton"} className="mdc-icon-button material-icons">create</button>
                    <button ref={"removeButton"} className="mdc-icon-button material-icons">delete</button>
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