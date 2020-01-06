import React from 'react';
import PipelineView from "./PipelineView";
import {MDCTabBar} from '@material/tab-bar';
import {MDCTextField} from "@material/textfield";
import {MDCRipple} from '@material/ripple';
import {handleErrors} from "../utils/all";


class SnapshotListItem extends React.Component {
    componentDidMount() {
        new MDCRipple(this.refs.listItem);
        new MDCRipple(this.refs.restore);
    }

    restoreSnapshot(){
        this.props.onRestoreSnapshot(this);
    }

    render(){
        return <div ref={"listItem"} className={"snapshot-item mdc-ripple-surface mdc-ripple-upgraded"}>
            <div className={"details"}>
                <i className={"material-icons"}>history</i> {this.props.snapshot.date.toLocaleDateString()}
                <h4>{this.props.snapshot.name}</h4>
            </div>
            <button ref={"restore"} onClick={this.restoreSnapshot.bind(this)} className="mdc-button mdc-button--raised">
                <div className="mdc-button__ripple"></div>
                <i className="material-icons mdc-button__icon" aria-hidden="true">settings_backup_restore</i>
                <span className="mdc-button__label">Restore</span>
            </button>
        </div>;
    }
}

class PipelineSettingsView extends React.Component {

    constructor(props) {
        super(props);

        this.tabs = ["general", "snapshots"];

        this.state = {
            active_tab_index: 0
        };
    }
    componentWillUnmount() {
    }

    componentDidMount() {
        const tabBar = new MDCTabBar(this.refs.tabBar);

        tabBar.listen("MDCTabBar:activated", (details) => {
            this.setState({"active_tab_index": details.detail.index});
        });

        this.initiateMDCComponents()
    }

    initiateMDCComponents(){
        if(this.refs.pipelineNameField){
            this.pipelineNameField = new MDCTextField(this.refs.pipelineNameField);
            this.pipelineNameField.value = this.props.name;
        }
        if(this.refs.saveGeneralForm){
            new MDCRipple(this.refs.saveGeneralForm);
        }

        // persistent items
        if(this.refs.closeButton && !this.closeButtonRipple){
            this.closeButtonRipple = new MDCRipple(this.refs.closeButton);
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.initiateMDCComponents()
    }

    closeSettings() {
        orkest.loadView(PipelineView, {"name": this.props.name, "uuid": this.props.uuid});
    }

    stub(){
    }

    saveGeneralForm(e){
        e.preventDefault();

        // new name
        let pipelineName = this.pipelineNameField.value;

        let formData = new FormData();
        formData.append("name", pipelineName);

        // perform POST to save
        fetch("/async/pipelines/rename/" + this.props.uuid, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: formData
        }).then(handleErrors).then((response) => {

            response.json().then((json) => {
                console.log(json)
                if(json.success === true) {
                    orkest.loadView(PipelineSettingsView, {name: pipelineName, uuid: this.props.uuid});
                }
            })

        })
    }

    restoreSnapshot(snapshot){
        console.log(this);
        console.log(snapshot);
    }

    render() {

        // TODO: make snapshots real
        let snapshots = [
            {
                "date": new Date(),
                "name": "Automatic",
            },
            {
                "date": new Date(new Date() - Math.random() * 1e9),
                "name": "Finalized Keras model parameter visualization",
            },
            {
                "date": new Date(new Date() - Math.random() * 1e9 - 1e9),
                "name": "Stable feature extraction train/test",
            }
        ];

        let snapshotComponents = [];
        for(let x = 0; x < snapshots.length; x++){
            let snapshot = snapshots[x];
            snapshotComponents.push(<SnapshotListItem onRestoreSnapshot={this.restoreSnapshot.bind(this)} key={x} snapshot={snapshot} />);
        }

        return <div className={"view-page view-pipeline-settings"}>
            <h2>Settings</h2>

            <div className="mdc-tab-bar" ref={"tabBar"} role="tablist">
                <div className="mdc-tab-scroller">
                    <div className="mdc-tab-scroller__scroll-area">
                        <div className="mdc-tab-scroller__scroll-content">
                            <button className="mdc-tab mdc-tab--active" role="tab" aria-selected="true" tabIndex="0">
                                <span className="mdc-tab__content">
                                    <span className="mdc-tab__icon material-icons" aria-hidden="true">subject</span>
                                    <span className="mdc-tab__text-label">General</span>
                                </span>
                                <span className="mdc-tab-indicator mdc-tab-indicator--active">
                                    <span className="mdc-tab-indicator__content mdc-tab-indicator__content--underline"></span>
                                </span>
                                <span className="mdc-tab__ripple"></span>
                            </button>
                            <button className="mdc-tab" role="tab" tabIndex="0">
                                <span className="mdc-tab__content">
                                    <span className="mdc-tab__icon material-icons" aria-hidden="true">history</span>
                                    <span className="mdc-tab__text-label">Snapshots</span>
                                </span>
                                <span className="mdc-tab-indicator">
                                    <span className="mdc-tab-indicator__content mdc-tab-indicator__content--underline"></span>
                                </span>
                                <span className="mdc-tab__ripple"></span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={"tab-content"}>
                {(() => {
                    switch(this.tabs[this.state.active_tab_index]){
                        case "general":
                            return <div>
                                <form>
                                    <div>
                                        <div ref={"pipelineNameField"} className="mdc-text-field">
                                            <input type="text" id="my-text-field" onChange={this.stub} className="mdc-text-field__input" />
                                            <label className="mdc-floating-label" htmlFor="my-text-field">Pipeline name</label>
                                            <div className="mdc-line-ripple"></div>
                                        </div>
                                    </div>

                                    <button ref={"saveGeneralForm"} onClick={this.saveGeneralForm.bind(this)} className="mdc-button mdc-button--raised">
                                        <div className="mdc-button__ripple"></div>
                                        <span className="mdc-button__label">Save</span>
                                    </button>
                                </form>
                            </div>;
                        case "snapshots":
                            return <div>
                                <h4>Snapshots for: {this.props.name}</h4>

                                <div className={"snapshot-list"}>
                                    { snapshotComponents }
                                </div>
                            </div>
                    }
                })()}
            </div>


            <button ref={"closeButton"} onClick={this.closeSettings.bind(this)}
                    className={"close-button mdc-button mdc-button--raised"}>
                <div className="mdc-button__ripple"></div>
                <i className="material-icons">close</i>
            </button>
        </div>;
    }
}

export default PipelineSettingsView;