import { MDCTextField } from '@material/textfield';
import { MDCSelect } from '@material/select';
import { MDCRipple } from '@material/ripple';
import { extensionFromFilename, filenameWithoutExtension } from "../utils/all";
import MDCSelectReact from "../mdc-components/MDCSelectReact";
import MDCTextFieldReact from "../mdc-components/MDCTextFieldReact";
import MDCTextFieldAreaReact from "../mdc-components/MDCTextFieldAreaReact";


import React from 'react';

class ConnectionItem extends React.Component {
    componentDidMount() {

    }

    render() {
        return <div className="connection-item" data-uuid={this.props.connection.uuid}><i className="material-icons">drag_indicator</i> <span>{this.props.connection.name[0]}</span> <span className="filename">({this.props.connection.name[1]})</span></div>
    }
}


class PipelineDetails extends React.Component {

    constructor(props) {
        super(props);

        console.log(this);

        this.state = {
            "kernelOptions": [
                ["docker_python", "Python 3"],
                ["docker_r", "R"]
            ],
            "imageOptions": [
                ["jupyter/scipy-notebook", "jupyter/scipy-notebook"]
            ],
            "isNotebookStep": true,
            "step": this.props.step
        }
    }

    componentWillUnmount() {
        $(document).off("mouseup.connectionList");
        $(document).off("mousemove.connectionList");
        $(window).off("resize.pipelineDetails");
        $(window).off("keyup.pipelineDetails");
    }

    updateStepName() {
        this.props.onNameUpdate(this.props.step.uuid, this.state.step.title, this.state.step.file_path);
    }

    onChangeFileName(updatedFileName) {
        this.state.step.file_path = updatedFileName + "." + extensionFromFilename(this.state.step.file_path);

        this.setState({
            "step": this.state.step
        });

        this.updateStepName();

        this.props.onSave(this);
    }

    onChangeFileType(updatedExtension) {
        this.state.step.file_path = filenameWithoutExtension(this.state.step.file_path) + updatedExtension;

        this.setState({
            "step": this.state.step,
            isNotebookStep: updatedExtension === ".ipynb"
        });

        this.updateStepName();
        this.props.onSave(this);
    }

    onChangeVCPUS(updatedVCPUS) {
        this.state.step.vcpus = updatedVCPUS;

        this.setState({
            "step": this.state.step
        });

        this.props.onSave(this);
    }

    onChangeGPUS(updatedGPUS) {
        this.state.step.gpus = updatedGPUS;
        this.setState({
            "step": this.state.step
        });

        this.props.onSave(this);
    }

    onChangeExperimentJSON(updatedExperimentJSON){
        this.state.step.experiment_json = updatedExperimentJSON;
        this.setState({
            "step": this.state.step
        });

        this.props.onSave(this);
    }

    onChangeMemory(updatedMemory) {
        this.state.step.memory = updatedMemory;

        this.setState({
            "step": this.state.step
        });

        this.props.onSave(this);
    }

    onChangeImage(updatedImage){
        this.state.step.image = updatedImage;

        this.setState({
            "step": this.state.step
        });

        this.props.onSave(this);
    }

    onChangeKernel(updatedKernel){
        this.state.step.kernel.name = updatedKernel;

        let kernelDisplayName = "";
        for(let x = 0; x < this.state.kernelOptions.length; x++){
            if(this.state.kernelOptions[x][0] === updatedKernel){
                kernelDisplayName = this.state.kernelOptions[x][1];
                break;
            }
        }

        this.setState({
            "step": this.state.step 
        });

        this.props.onSave(this);
    }

    onChangeTitle(updatedTitle) {
        this.state.step.title = updatedTitle;

        this.setState({
            "step": this.state.step
        });

        this.updateStepName();

        this.props.onSave(this);
    }

    onOpenNotebook() {
        this.props.onOpenNotebook(this);
    }

    onRunIncoming() {
        this.props.onRunIncoming(this);
    }

    componentDidMount() {

        this.deleteButtonRipple = new MDCRipple(this.refs.deleteButton);

        // initiate draggable connections
        let _this = this;

        let previousPosition = 0;
        let connectionItemOffset = 0;
        let oldConnectionIndex = 0;
        let newConnectionIndex = 0;
        let numConnectionListItems = $(_this.refs.connectionList).find('.connection-item').length;

        $(this.refs.connectionList).on("mousedown", ".connection-item", function (e) {

            previousPosition = e.clientY;
            connectionItemOffset = 0;

            $(_this.refs.connectionList).addClass("dragging");

            oldConnectionIndex = $(this).index();

            $(this).addClass('selected');

            console.log("[Assert] Should trigger once, otherwise listener duplication going on.");

        });


        $(document).on("mousemove.connectionList", function (e) {

            let selectedConnection = $(_this.refs.connectionList).find(".connection-item.selected");

            if (selectedConnection.length > 0) {

                let positionDelta = e.clientY - previousPosition;
                let itemHeight = selectedConnection.outerHeight();

                connectionItemOffset += positionDelta;

                // limit connectionItemOffset
                if (connectionItemOffset < -itemHeight * oldConnectionIndex) {
                    connectionItemOffset = -itemHeight * oldConnectionIndex;
                }
                else if (connectionItemOffset > itemHeight * ((numConnectionListItems - oldConnectionIndex) - 1)) {
                    connectionItemOffset = itemHeight * ((numConnectionListItems - oldConnectionIndex) - 1);
                }

                selectedConnection.css({
                    transform:
                        "translateY(" + connectionItemOffset + "px)"
                });

                previousPosition = e.clientY;


                // find new index based on current position
                let elementYPosition = ((oldConnectionIndex * itemHeight) + connectionItemOffset) / itemHeight;

                newConnectionIndex = Math.min(
                    Math.max(
                        0,
                        Math.round(elementYPosition)
                    ),
                    numConnectionListItems - 1
                );

                // evaluate swap classes for all elements in list besides selectedConnection
                for (let i = 0; i < numConnectionListItems; i++) {
                    if (i != oldConnectionIndex) {

                        let connectionListItem = $(_this.refs.connectionList).find(".connection-item").eq(i);

                        connectionListItem.removeClass("swapped-up");
                        connectionListItem.removeClass("swapped-down");

                        if (newConnectionIndex >= i && i > oldConnectionIndex) {
                            connectionListItem.addClass("swapped-up");
                        }
                        else if (newConnectionIndex <= i && i < oldConnectionIndex) {
                            connectionListItem.addClass("swapped-down")
                        }
                    }
                }

            }

        });

        // Note, listener should be unmounted
        $(document).on("mouseup.connectionList", function (e) {

            let selectedConnection = $(_this.refs.connectionList).find(".connection-item.selected");

            if (selectedConnection.length > 0) {
                selectedConnection.css({ transform: "" });
                selectedConnection.removeClass("selected");

                $(_this.refs.connectionList).find(".connection-item")
                    .removeClass("swapped-up")
                    .removeClass("swapped-down");

                $(_this.refs.connectionList).removeClass("dragging");

                _this.swapConnectionOrder(oldConnectionIndex, newConnectionIndex);
            }
        });

        // overflow checks
        $(window).on("resize.pipelineDetails", this.overflowChecks.bind(this))
        this.overflowChecks();

    }

    overflowChecks() {
        $('.overflowable').each(function () {
            if ($(this).overflowing()) {
                $(this).addClass("overflown");
            } else {
                $(this).removeClass("overflown");
            }
        })
    }

    swapConnectionOrder(oldConnectionIndex, newConnectionIndex) {

        // check if there is work to do
        if (oldConnectionIndex != newConnectionIndex) {

            // note it's creating a reference
            let connectionList = this.state.step.incoming_connections;

            let tmp = connectionList[oldConnectionIndex];
            connectionList.splice(oldConnectionIndex, 1);
            connectionList.splice(newConnectionIndex, 0, tmp);

            this.state.step.incoming_connections = connectionList;

            this.setState({
                "step": this.state.step
            });

            this.props.onSave(this);

        }

    }

    render() {

        let connections = this.state.step.incoming_connections.map((item, key) => (
            <ConnectionItem connection={
                {
                    name: this.props.connections[item],
                    uuid: item
                }
            } key={key} />
        ));

        return <div className={"pipeline-details pane"}>
            <div className={"overflowable"}>
                <div className="input-group">
                    <h3>Pipeline step</h3>

                    <MDCTextFieldReact
                        value={this.state.step.title}
                        onChange={this.onChangeTitle.bind(this)}
                        label="Title"
                        classNames={["fullwidth", "push-down"]}
                    />

                    <div className={"multi-field-input"}>

                        <MDCTextFieldReact
                            value={filenameWithoutExtension(this.state.step.file_path)}
                            onChange={this.onChangeFileName.bind(this)}
                            label="File name"
                        />

                        <MDCSelectReact label="File extension" onChange={this.onChangeFileType.bind(this)} items={[
                            [".ipynb", ".ipynb"],
                            [".py", ".py"],
                            [".R", ".R"],
                            [".sh", ".sh"]
                        ]}
                            selected={"." + extensionFromFilename(this.state.step.file_path)}
                        />
                        <span className={'clear'}></span>
                    </div>

                    <MDCSelectReact 
                        label="Kernel" 
                        onChange={this.onChangeKernel.bind(this)} items={this.state.kernelOptions}
                        selected={this.state.step.kernel.name}
                        classNames={(() => {
                            let classes = ["push-down"];
                            if (!this.state.isNotebookStep) {
                                classes.push("hidden");
                            }
                            return classes
                        })()}
                        />
                    
                    <MDCSelectReact 
                        label="Image" 
                        onChange={this.onChangeImage.bind(this)} items={this.state.imageOptions}
                        selected={this.state.step.image}
                    />
                </div>

                <div className="input-group">
                    <h3>Compute resources</h3>

                    <MDCSelectReact
                        value={this.state.step.memory}
                        onChange={this.onChangeVCPUS.bind(this)}
                        label="Number of vCPUs"
                        items={[
                            ["1", "1 vCPU"],
                            ["2", "2 vCPU"],
                            ["4", "4 vCPU"]
                        ]}
                        selected={this.state.step.vcpus}
                        classNames={["push-down"]}
                    />

                    <MDCSelectReact
                        value={this.state.step.memory}
                        onChange={this.onChangeGPUS.bind(this)}
                        label="Number of GPUs"
                        items={[
                            ["0", "No GPU"],
                            ["1", "1 GPU"],
                            ["2", "2 GPUs"],
                            ["3", "3 GPUs"],
                            ["3", "4 GPUs"]
                        ]}
                        selected={this.state.step.gpus}
                        classNames={["push-down"]}
                    />

                    <MDCTextFieldReact 
                        value={this.state.step.memory}
                        onChange={this.onChangeMemory.bind(this)}
                        label="Memory (in MiB)"
                    />
                </div>

                <div className="input-group">
                    <h3>Experiment</h3>

                    <MDCTextFieldAreaReact 
                        onChange={this.onChangeExperimentJSON.bind(this)}
                        label="JSON argument description"
                        value={this.state.step.experiment_json}
                    />
                    
                </div>

                <div className="input-group">
                    <h3>Connections</h3>

                    <div className="connection-list" ref="connectionList">
                        {connections}
                    </div>
                </div>

            </div>

            <div className={"action-buttons-bottom"}>

                <div className={"notebook-actions"}>
                    <button ref={"launchNotebook"} onClick={this.onOpenNotebook.bind(this)} className="mdc-button mdc-button--raised save-button">
                        <div className="mdc-button__ripple"></div>
                        <i className="material-icons mdc-button__icon" aria-hidden="true">launch</i>
                        <span className="mdc-button__label">Open notebook</span>
                    </button>

                    <button ref={"launchNotebook"} onClick={this.onRunIncoming.bind(this)} className="mdc-button mdc-button--raised save-button">
                        <div className="mdc-button__ripple"></div>
                        <i className="material-icons mdc-button__icon" aria-hidden="true">replay</i>
                        <span className="mdc-button__label">Run incoming steps</span>
                    </button>
                </div>

                <div className={"general-actions"}>
                    <button ref={"deleteButton"} className="mdc-button mdc-button--raised" onClick={this.props.onClose.bind(this)}>
                        <div className="mdc-button__ripple"></div>
                        <i className="material-icons mdc-button__icon" aria-hidden="true">close</i>
                        <span className="mdc-button__label">Close</span>
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