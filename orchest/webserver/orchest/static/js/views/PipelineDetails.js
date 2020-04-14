import {MDCTextField} from '@material/textfield';
import {MDCSelect} from '@material/select';
import {MDCRipple} from '@material/ripple';

import React from 'react';

class ConnectionItem extends React.Component {
    componentDidMount() {

    }

    render(){
        return <div className="connection-item" data-uuid={this.props.connection.uuid}><i className="material-icons">drag_indicator</i> {this.props.connection.name}</div>
    }
}


class PipelineDetails extends React.Component {

    changeFileName(){

    }

    changeImage(){

    }

    constructor(props){
        super(props);


        this.state = {
            "incoming_connections": this.props.step.incoming_connections
        }
    } 

    changeVCPU(){

    }

    changeMemory(){

    }

    changeName(e){
        this.inputFileName.value = nameToFilename(e.target.value);

        // send name update to React state
        this.props.onNameUpdate(this.props.step.uuid, e.target.value);
    }

    onSave(){
        this.props.onSave(this);
    }

    onOpenNotebook(){
        this.props.onOpenNotebook(this);
    }

    componentDidMount() {

        this.selectFileType = new MDCSelect(this.refs.selectFile);
        let split_file_path = this.props.step.file_path.split(".");
        let filepath = split_file_path.slice(0, split_file_path.length - 1).join(".");

        this.selectFileType.value = "." + split_file_path[split_file_path.length - 1];

        this.inputFileName = new MDCTextField(this.refs.inputFileName);
        this.inputFileName.value = filepath;

        this.inputName = new MDCTextField(this.refs.inputName);
        this.inputName.value = this.props.step.name;

        this.inputMemory = new MDCTextField(this.refs.inputMemory);
        this.inputMemory.value = this.props.step.memory;

        // this.selectFileType.listen('MDCSelect:change', () => {
        //   // alert(`Selected option at index ${select.selectedIndex} with value "${select.value}"`);

        // });

        this.selectKernel = new MDCSelect(this.refs.selectKernel);
        this.selectKernel.value = this.props.step.image.image_name;

        // this.selectKernel.listen('MDCSelect:change', () => {
        //   // alert(`Selected option at index ${selectKernel.selectedIndex} with value "${selectKernel.value}"`);
        // });

        this.selectVCPU = new MDCSelect(this.refs.selectVCPU);
        this.selectVCPU.value = this.props.step.vcpus;

        this.selectGPU = new MDCSelect(this.refs.selectGPU);
        this.selectGPU.value = this.props.step.gpus;

        // this.selectVCPU.listen('MDCSelect:change', () => {
        //   // alert(`Selected option at index ${selectVCPU.selectedIndex} with value "${selectVCPU.value}"`);
        // });

        this.saveButtonRipple = new MDCRipple(this.refs.saveButton);
        this.deleteButtonRipple = new MDCRipple(this.refs.deleteButton);

        this.inputName.focus();

        this.experimentJSON = new MDCTextField(this.refs.experimentJSON);
        this.experimentJSON.value = this.props.step.experiment_json;


        // initiate draggable connections
        let _this = this;


        let previousPosition = 0;
        let connectionItemOffset = 0;
        let oldConnectionIndex = 0;
        let newConnectionIndex = 0;
        let numConnectionListItems = $(_this.refs.connectionList).find('.connection-item').length;

        $(this.refs.connectionList).on("mousedown", ".connection-item", function(e){

            previousPosition = e.clientY;
            connectionItemOffset = 0;

            $(_this.refs.connectionList).addClass("dragging");

            oldConnectionIndex = $(this).index();

            $(this).addClass('selected');

            console.log("[Assert] Should trigger once, otherwise listener duplication going on.");

        });
        
        
        $(document).on("mousemove.connectionList", function(e){

            let selectedConnection = $(_this.refs.connectionList).find(".connection-item.selected");

            if(selectedConnection.length > 0){

                let positionDelta = e.clientY - previousPosition;
                let itemHeight = selectedConnection.outerHeight();

                connectionItemOffset += positionDelta;

                // limit connectionItemOffset
                if(connectionItemOffset < -itemHeight * oldConnectionIndex){
                    connectionItemOffset = -itemHeight * oldConnectionIndex;
                }
                else if(connectionItemOffset > itemHeight * ((numConnectionListItems-oldConnectionIndex) - 1)){
                    connectionItemOffset = itemHeight * ((numConnectionListItems-oldConnectionIndex) - 1);
                }
                
                selectedConnection.css({
                    transform: 
                        "translateY(" + connectionItemOffset + "px)"
                });
                
                previousPosition = e.clientY;

                
                // find new index based on current position
                let elementYPosition = ((oldConnectionIndex * itemHeight) + connectionItemOffset)/ itemHeight;

                newConnectionIndex = Math.min(
                    Math.max(
                        0, 
                        Math.round(elementYPosition)
                    ), 
                    numConnectionListItems - 1
                );

                // evaluate swap classes for all elements in list besides selectedConnection
                for(let i = 0; i < numConnectionListItems; i++){
                    if(i != oldConnectionIndex){

                        let connectionListItem = $(_this.refs.connectionList).find(".connection-item").eq(i);

                        connectionListItem.removeClass("swapped-up");
                        connectionListItem.removeClass("swapped-down");

                        if(newConnectionIndex >= i && i > oldConnectionIndex){
                            connectionListItem.addClass("swapped-up");
                        }
                        else if(newConnectionIndex <= i && i < oldConnectionIndex){
                            connectionListItem.addClass("swapped-down")
                        }
                    }
                }

            }

        });

        // Note, listener should be unmounted
        $(document).on("mouseup.connectionList", function(e){

            let selectedConnection = $(_this.refs.connectionList).find(".connection-item.selected");

            if(selectedConnection.length > 0){
                selectedConnection.css({transform: ""});
                selectedConnection.removeClass("selected");
                
                $(_this.refs.connectionList).find(".connection-item")
                .removeClass("swapped-up")
                .removeClass("swapped-down");
    
                $(_this.refs.connectionList).removeClass("dragging");
    
                _this.swapConnectionOrder(oldConnectionIndex, newConnectionIndex);
            }
        });
    }

    swapConnectionOrder(oldConnectionIndex, newConnectionIndex){

        // check if there is work to do
        if(oldConnectionIndex != newConnectionIndex){

            // note it's creating a reference
            let connectionList = this.state.incoming_connections;

            let tmp = connectionList[oldConnectionIndex];
            connectionList.splice(oldConnectionIndex, 1);
            connectionList.splice(newConnectionIndex, 0, tmp);

            this.setState({
                "incoming_connections": connectionList
            });
            
        }

    }


    componentWillUnmount(){
        $(document).off("mouseup.connectionList");
        $(document).off("mousemove.connectionList");
    }

    render() {

        let connections = this.state.incoming_connections.map((item, key) => (
            <ConnectionItem connection={
                {
                    name: this.props.connections[item],
                    uuid: item
                }
            } key={key} />
        ));

        return <div className={"pipeline-details"}>
            <h3>Pipeline step</h3>

            <div ref={"inputName"} className="mdc-text-field fullwidth push-down">
                <input onChange={this.changeName.bind(this)} className="mdc-text-field__input"
                       type="text"
                       id="step-input-name" />
                <label className="mdc-floating-label" htmlFor="step-input-name">Pipeline step name</label>
                <div className="mdc-line-ripple"></div>
            </div>

            <div className={"multi-field-input"}>
                <div ref={"inputFileName"} className="mdc-text-field">
                    <input onChange={this.changeFileName.bind(this)} className="mdc-text-field__input"
                           type="text"
                           id="step-input-file_name" />
                    <label className="mdc-floating-label" htmlFor="step-input-file_name">File name</label>
                    <div className="mdc-line-ripple"></div>
                </div>
                <div className="mdc-select" ref={"selectFile"}>
                    <div className="mdc-select__anchor fullwidth">
                        <i className="mdc-select__dropdown-icon"></i>
                        <div className="mdc-select__selected-text"></div>
                        <span className="mdc-floating-label">File extension</span>
                        <div className="mdc-line-ripple"></div>
                    </div>

                    <div className="mdc-select__menu mdc-menu mdc-menu-surface demo-width-class">
                        <ul className="mdc-list">

                            <li className="mdc-list-item" data-value=".ipynb">
                                .ipynb
                            </li>
                            <li className="mdc-list-item" data-value=".py">
                                .py
                            </li>
                            <li className="mdc-list-item" data-value=".R">
                                .R
                            </li>
                            <li className="mdc-list-item" data-value=".sh">
                                .sh
                            </li>
                        </ul>
                    </div>
                </div>
                <span className={'clear'}></span>
            </div>

            <div className="mdc-select" ref={"selectKernel"}>
                <div className="mdc-select__anchor demo-width-class">
                    <i className="mdc-select__dropdown-icon"></i>
                    <div className="mdc-select__selected-text"></div>
                    <span className="mdc-floating-label">Kernel image</span>
                    <div className="mdc-line-ripple"></div>
                </div>

                <div className="mdc-select__menu mdc-menu mdc-menu-surface demo-width-class">
                    <ul className="mdc-list">
                        <li className="mdc-list-item" data-value="python_docker">
                            Python on Docker
                        </li>
                        <li className="mdc-list-item" data-value="r_docker">
                            R on Docker
                        </li>
                    </ul>
                </div>
            </div>

            <h3>Compute resources</h3>

            <div className="mdc-select push-down" ref={"selectVCPU"}>
                <div className="mdc-select__anchor demo-width-class">
                    <i className="mdc-select__dropdown-icon"></i>
                    <div className="mdc-select__selected-text"></div>
                    <span className="mdc-floating-label">Number of vCPUs</span>
                    <div className="mdc-line-ripple"></div>
                </div>

                <div className="mdc-select__menu mdc-menu mdc-menu-surface demo-width-class">
                    <ul className="mdc-list">
                        <li className="mdc-list-item" data-value="1">
                            1 vCPU
                        </li>
                        <li className="mdc-list-item" data-value="2">
                            2 vCPUs
                        </li>
                        <li className="mdc-list-item" data-value="4">
                            4 vCPUs
                        </li>
                    </ul>
                </div>
            </div>

            <div className="mdc-select push-down" ref={"selectGPU"}>
                <div className="mdc-select__anchor demo-width-class">
                    <i className="mdc-select__dropdown-icon"></i>
                    <div className="mdc-select__selected-text"></div>
                    <span className="mdc-floating-label">Number of GPUs</span>
                    <div className="mdc-line-ripple"></div>
                </div>

                <div className="mdc-select__menu mdc-menu mdc-menu-surface demo-width-class">
                    <ul className="mdc-list">
                        <li className="mdc-list-item" data-value="0">
                            No GPU
                        </li>
                        <li className="mdc-list-item" data-value="1">
                            1 GPU
                        </li>
                        <li className="mdc-list-item" data-value="2">
                            2 GPUs
                        </li>
                        <li className="mdc-list-item" data-value="3">
                            3 GPUs
                        </li>
                        <li className="mdc-list-item" data-value="4">
                            4 GPUs
                        </li>
                    </ul>
                </div>
            </div>

            <label>
                <div ref={"inputMemory"} className="mdc-text-field">
                    <input id="step-input-memory" onChange={this.changeMemory.bind(this)}  className="mdc-text-field__input"
                       type="number" />
                    <label className="mdc-floating-label" htmlFor="step-input-memory">Memory (in MiB)</label>
                    <div className="mdc-line-ripple"></div>
                </div>
            </label>

            <h3>Experiment</h3>

            <div className="mdc-text-field mdc-text-field--textarea" ref="experimentJSON">
                <textarea className="mdc-text-field__input" rows="5"></textarea>
                <div className="mdc-notched-outline">
                    <div className="mdc-notched-outline__leading"></div>
                    <div className="mdc-notched-outline__notch">
                        <label htmlFor="textarea" className="mdc-floating-label">JSON argument description</label>
                    </div>
                    <div className="mdc-notched-outline__trailing"></div>
                </div>
            </div>

            <h3>Connections</h3>

            <div className="connection-list" ref="connectionList">
                { connections }
            </div>

            <div className={"action-buttons-bottom"}>

                <div className={"notebook-actions"}>
                    <button ref={"launchNotebook"} onClick={this.onOpenNotebook.bind(this)} className="mdc-button mdc-button--raised save-button">
                        <div className="mdc-button__ripple"></div>
                        <i className="material-icons mdc-button__icon" aria-hidden="true">launch</i>
                        <span className="mdc-button__label">Open notebook</span>
                    </button>

                    <button ref={"launchNotebook"} onClick={this.onOpenNotebook.bind(this)} className="mdc-button mdc-button--raised save-button">
                        <div className="mdc-button__ripple"></div>
                        <i className="material-icons mdc-button__icon" aria-hidden="true">replay</i>
                        <span className="mdc-button__label">Rerun incoming steps</span>
                    </button>
                </div>

                <div className={"general-actions"}>
                    <button ref={"saveButton"} onClick={this.onSave.bind(this)} className="mdc-button mdc-button--raised save-button">
                        <div className="mdc-button__ripple"></div>
                        <span className="mdc-button__label">Save</span>
                    </button>

                    <button ref={"deleteButton"} className="mdc-button mdc-button--raised" onClick={this.props.onDelete.bind(this)}>
                        <div className="mdc-button__ripple"></div>
                        <i className="material-icons mdc-button__icon" aria-hidden="true">delete</i>
                        <span className="mdc-button__label">Delete</span>
                    </button>
                </div>

            </div>

        </div>
    }
}

export default PipelineDetails;