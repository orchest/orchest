import React from 'react';
import { extensionFromFilename, filenameWithoutExtension } from "../utils/all";
import MDCSelectReact from "../mdc-components/MDCSelectReact";
import MDCTextFieldReact from "../mdc-components/MDCTextFieldReact";
import MDCTextFieldAreaReact from "../mdc-components/MDCTextFieldAreaReact";

class ConnectionItem extends React.Component {
    componentDidMount() {

    }

    render() {
        return <div className="connection-item" data-uuid={this.props.connection.uuid}><i className="material-icons">drag_indicator</i> <span>{this.props.connection.name[0]}</span> <span className="filename">({this.props.connection.name[1]})</span></div>
    }
}


class PipelineDetailsProperties extends React.Component {
    componentWillUnmount() {
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

    constructor(props){
        super(props);

        this.state = {
            "kernelOptions": [
                ["python", "Python 3"],
                ["r", "R"]
            ],
            "imageOptions": [
                ["jupyter/scipy-notebook", "jupyter/scipy-notebook"]
            ],
            "isNotebookStep": true,
            "step": this.props.step
        }
    }
    componentDidMount() {

        // set focus on first field
        this.refs.titleTextField.focus();

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

        return <div className={"detail-subview"}>
            <div className="input-group">

                <MDCTextFieldReact
                    value={this.state.step.title}
                    onChange={this.onChangeTitle.bind(this)}
                    label="Title"
                    classNames={["fullwidth", "push-down"]}
                    ref="titleTextField"
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
        </div>;
    }
}

export default PipelineDetailsProperties;