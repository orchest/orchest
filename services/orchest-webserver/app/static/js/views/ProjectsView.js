import React, { Fragment } from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import MDCDataTableReact from '../lib/mdc-components/MDCDataTableReact';
import MDCDialogReact from '../lib/mdc-components/MDCDialogReact';
import MDCIconButtonToggleReact from '../lib/mdc-components/MDCIconButtonToggleReact';
import MDCLinearProgressReact from '../lib/mdc-components/MDCLinearProgressReact';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';

import { makeRequest, makeCancelable, PromiseManager, RefManager } from '../lib/utils/all';
import PipelinesView from './PipelinesView';


class ProjectsView extends React.Component {

    componentWillUnmount() {

    }

    constructor(props) {
        super(props);

        this.state = {
            createModal: false,
            loading: true
        }

        this.promiseManager = new PromiseManager();
        this.refManager = new RefManager();
    }

    componentWillUnmount(){
        this.promiseManager.cancelCancelablePromises();
    }

    componentDidMount() {

        this.fetchList();

    }

    processListData(projects){

        let listData = [];

        for(let project of projects){
            listData.push([
                <span>{project}</span>
            ]);
        }

        return listData
    }

    fetchList(){
        // initialize REST call for pipelines
        let fetchListPromise = makeCancelable(makeRequest("GET", '/async/projects'), this.promiseManager);
        
        fetchListPromise.promise.then((response) => {
            let projects = JSON.parse(response);            
            this.setState({loading: false, listData: this.processListData(projects), projects: projects})
            if(this.refManager.refs.projectListView){
                this.refManager.refs.projectListView.setSelectedRowIds([]);
            }
            
        });
    }

    onClickListItem(row, idx, e) {

        let project = this.state.projects[idx];
        
        let props = {
            "project": project,
        }

        orchest.loadView(PipelinesView, props);

    }

    onDeleteClick(){

        let selectedIndices = this.refManager.refs.projectListView.getSelectedRowIndices();
        
        if(selectedIndices.length === 0){
            orchest.alert("Error", "You haven't selected a project.")
            return;
        }

        orchest.confirm("Warning", "Are you certain that you want to delete this project? (This cannot be undone.)", () => {

            let deletePromises = [];

            selectedIndices.forEach((index) => {
                
                let project_uuid = this.state.projects[index].uuid;

                // TODO:
                // - shut down all sessions that are part of this project

                makeRequest("GET", `/api-proxy/api/sessions/${this.props.project_uuid}/${this.props.pipeline_uuid}`).then((response) => {
                    let data = JSON.parse(response);
                    if(data["sessions"].length > 0){

                        let sessionDeletePromises = [];

                        for(let session in data["sessions"]){
                            sessionDeletePromises.push(makeRequest("DELETE", `/api-proxy/api/sessions/${session.project_uuid}/${session.pipeline_uuid}`));
                        }

                        Promise.all(sessionDeletePromises).then(() => {
                            let deletePromise = makeRequest("DELETE", "/async/projects", {
                                type: "json",
                                content: {
                                    "project_uuid": project_uuid
                                }
                            });
            
                            deletePromises.push(deletePromise)
            
                            deletePromise.catch((response) => {
                                try {
                                    let data = JSON.parse(response.body);
            
                                    orchest.alert("Could not delete project. Reason " + data.message)
                                } catch {
                                    orchest.alert("Could not delete project. Reason unknown.");
                                }
                            })
                        })
                        
                    }
                })

            });

            Promise.all(deletePromises).then(() => {
                // reload list once creation succeeds
                this.fetchList()
            })

        })
    }

    onCreateClick(){
        this.setState({
            createModal: true
        })

        this.refManager.refs.createProjectNameTextField.focus();
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }

    onSubmitModal(){

        let projectName = this.refManager.refs.createProjectNameTextField.mdc.value;
        
        if(!projectName){
            orchest.alert("Error", "Please enter a name.")
            return;
        }

        makeRequest("POST", "/async/projects", {
            type: "json",
            content: {
                "name": projectName
            }
        }).then((_) => {
            // reload list once creation succeeds
            this.fetchList()
        }).catch((response) => {
            try {
                let data = JSON.parse(response.body);

                orchest.alert("Could not create project. Reason " + data.message)
            } catch {
                orchest.alert("Could not create project. Reason unknown.");
            }
        })

        this.setState({
            createModal: false
        })
    }

    onCancelModal(){
        this.setState({
            createModal: false
        })
    }

    render() {
        return <div className={"view-page projects-view"}>

            {(() => {
                if(this.state.createModal){
                    return <MDCDialogReact title="Create a new project" 
                        content={
                            <MDCTextFieldReact ref={this.refManager.nrefs.createProjectNameTextField} classNames={['fullwidth']} label="Project name" />
                    } actions={
                        <Fragment>
                            <MDCButtonReact icon="device_hub" classNames={["mdc-button--raised", "themed-secondary"]} label="Create pipeline" onClick={this.onSubmitModal.bind(this)} />                            
                            <MDCButtonReact icon="close" label="Cancel" classNames={["push-left"]} onClick={this.onCancelModal.bind(this)} />
                        </Fragment>
                    } />
                }
            })() }

            <h2>Projects</h2>

            {(() => {
                if(this.state.loading){
                    return <MDCLinearProgressReact />;
                }else{
                    return <Fragment>
                        <div className={"pipeline-actions push-down"}>
                            <MDCIconButtonToggleReact icon="add" onClick={this.onCreateClick.bind(this)} />
                            <MDCIconButtonToggleReact icon="delete" onClick={this.onDeleteClick.bind(this)} />
                        </div>
                        
                        <MDCDataTableReact ref={this.refManager.nrefs.projectListView} selectable onRowClick={this.onClickListItem.bind(this)} classNames={['fullwidth']} headers={["Project"]} rows={this.state.listData}  />
                    </Fragment>
                }
            })()}
            
        </div>;

    }
}

export default ProjectsView;