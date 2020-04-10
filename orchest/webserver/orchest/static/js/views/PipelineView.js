import React from 'react';
import {MDCSelect} from '@material/select';
import {MDCRipple} from '@material/ripple';
import {MDCTextField} from '@material/textfield';

import {handleErrors, uuidv4, nameToFilename} from "../utils/all";
import PipelineSettingsView from "./PipelineSettingsView";

class PipelineStep extends React.Component {
    render() {
        return <div data-uuid={this.props.step.uuid} ref={"container"} className={"pipeline-step"}>
            <div className={"incoming-connections connection-point"}>

            </div>
            <div className="step-label-holder">
                <div className={"step-label"}>
                    {this.props.step.name}
                </div>
            </div>
            <div className={"outgoing-connections connection-point"}>

            </div>
        </div>
    }
}

class PipelineDetails extends React.Component {

    changeFileName(){

    }

    changeImage(){

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
    }



    render() {
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
                        <li className="mdc-list-item" data-value="kernel-r-331">
                            R 3.3.1 (not working)
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



function ConnectionDOMWrapper(el, startNode, endNode, pipelineView){

    this.startNode = startNode;
    this.endNode = endNode;

    this.x = 0;
    this.y = 0;

    this.pipelineView = pipelineView;

    // initialize xEnd and yEnd at startNode position
    let startNodePosition = nodeCenter(this.startNode);
    startNodePosition = correctedPosition(startNodePosition.x, startNodePosition.y, $('.pipeline-view'));
    this.xEnd = startNodePosition.x;
    this.yEnd = startNodePosition.y;

    this.svgPadding = 5;
    this.arrowWidth = 7;

    this.el = $(el);

    this.remove = function(){
        this.el.remove();
    };

    this.setStartNode = function(startNodeJEl){
        this.startNode = startNodeJEl;
        if(startNodeJEl){
            this.startNodeUUID = this.startNode.parents(".pipeline-step").attr("data-uuid");
            this.el.attr("data-start-uuid", this.startNodeUUID);
        }
    };

    this.setEndNode = function(endNodeJEl){
        this.endNode = endNodeJEl;
        if(endNodeJEl){
            this.endNodeUUID = this.endNode.parents(".pipeline-step").attr("data-uuid");
            this.el.attr("data-end-uuid", this.endNodeUUID);
        }
    };

    this.selectState = function(){
        $(this.svgPath).attr("stroke", "blue");
        this.el.addClass("selected");
        $(this.svgPath).attr("stroke-width", 3);
    };

    this.deselectState = function(){
        this.el.removeClass("selected");
        $(this.svgPath).attr("stroke", "black");
        $(this.svgPath).attr("stroke-width", 2);
    };

    this.setStartNode(this.startNode);
    this.setEndNode(this.endNode);

    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg" ,"svg");
    this.svgPath = document. createElementNS("http://www.w3.org/2000/svg", "path");
    this.svgPath.setAttribute("stroke", "black");
    this.svgPath.setAttribute("stroke-width", "2");
    this.svgPath.setAttribute("fill", "none");
    this.svgPath.setAttribute("id", "path");
    this.svgEl.appendChild(this.svgPath);

    this.el.append(this.svgEl);

    this.render = function(){

        let startNodePosition = nodeCenter(this.startNode);
        startNodePosition = correctedPosition(startNodePosition.x, startNodePosition.y, $('.pipeline-view'));
        this.x = startNodePosition.x;
        this.y = startNodePosition.y;


        // set xEnd and yEnd if endNode is defined
        if(this.endNode){
            let endNodePosition = nodeCenter(this.endNode);
            endNodePosition = correctedPosition(endNodePosition.x, endNodePosition.y, $('.pipeline-view'));
            this.xEnd = endNodePosition.x;
            this.yEnd = endNodePosition.y;
        }

        let targetX = this.xEnd - this.x;
        let targetY = this.yEnd - this.y;

        let xOffset = 0;
        let yOffset = 0;

        if(targetX < 0){
            xOffset = targetX
        }
        if(targetX < this.arrowWidth){
            this.el.addClass("flipped-horizontal");
        }else{
            this.el.removeClass("flipped-horizontal");
        }

        if(targetY < 0){
            yOffset = targetY;
            this.el.addClass("flipped");
        }else{
            this.el.removeClass("flipped");
        }

        this.el.css('transform', "translateX("+(this.x-this.svgPadding+xOffset)+"px) translateY("+(this.y-this.svgPadding+yOffset)+"px)");

        // update svg poly line
        this.svgEl.setAttribute("width", (Math.abs(targetX) + 2*this.svgPadding) + "px");
        this.svgEl.setAttribute("height", (Math.abs(targetY) + 2*this.svgPadding) + "px");

        this.svgPath.setAttribute('d', this.curvedHorizontal(this.svgPadding - xOffset,
            this.svgPadding - yOffset,
            this.svgPadding + targetX - xOffset - this.arrowWidth,
            this.svgPadding + targetY - yOffset));
    };

    this.curvedHorizontal = function(x1, y1, x2, y2){
      let line = [];
      let mx = x1 + (x2 - x1) / 2;

      line.push('M', x1, y1);
      line.push('C', mx, y1, mx, y2, x2, y2);

      return line.join(' ')
    };
}

function PipelineStepDOMWrapper(el, uuid, reactRef){
    this.el = $(el);
    this.uuid = uuid;
    this.reactRef = reactRef;
    this.x = 0;
    this.y = 0;
    this.dragged = false;

    this.restore = function () {
        this.x = this.reactRef.props.step.meta_data.position[0];
        this.y = this.reactRef.props.step.meta_data.position[1];
    };

    this.render = function(){
        this.el.css('transform', "translateX("+this.x+"px) translateY("+this.y+"px)");
    };

    this.save = function(){
        this.reactRef.props.onMove(this.uuid, this.x, this.y);
    };
}

function nodeCenter(el){

    let position = {};

    position.x = el.offset().left + el.width()/2;
    position.y = el.offset().top + el.height()/2;

    return position;
}

function correctedPosition(x, y, el){
    let elementOffset = el.offset();
    let position = {};
    position.x = x - elementOffset.left;
    position.y = y- elementOffset.top;
    return position;
}

function renderConnections(connections){
    for(let x = 0; x < connections.length; x++){
        connections[x].render();
    }
}

class PipelineView extends React.Component {

    componentWillUnmount() {
    }

    encodeJSON(){
        // generate JSON representation using the internal state of React components describing the pipeline
        let pipelineJSON = {
            "name": this.props.name,
            "uuid": this.props.uuid,
            "steps": {}
        };

        for(let key in this.state.steps){
            if(this.state.steps.hasOwnProperty(key)){
                let step = this.state.steps[key];
                pipelineJSON["steps"][step.uuid] = step;
            }
        }

        console.log(JSON.stringify(pipelineJSON));

        let formData = new FormData();
        formData.append("pipeline_json", JSON.stringify(pipelineJSON));

        formData.append("pipeline_uuid", pipelineJSON.uuid);

        // perform POST to save
        fetch("/async/pipelines/json/save", {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: formData
        });
    }

    decodeJSON(jsonPipeline){
        // initialize React components based on incoming JSON description of the pipeline
        console.log(jsonPipeline);

        // add steps to the state
        let steps = this.state.steps;

        for(let key in jsonPipeline.steps){
            if(jsonPipeline.steps.hasOwnProperty(key)){
                steps[key] = jsonPipeline.steps[key];
            }
        }

        this.setState({"steps": steps});
    }

    constructor(props) {
        super(props);

        this.selectedItem = undefined;
        this.selectedConnection = undefined;

        // newConnection is for creating a new connection
        this.newConnection = undefined;

        this.connections = [];
        this.pipelineSteps = {};
        this.pipelineRefs = [];
        this.prevPosition = [];
        this.pipelineListenersInitialized = false;

        this.state = {
            selectedStep: undefined,
            steps: {},
            backend: {
                running: false,
                booting: false
            }
        }
    }

    openSettings(){
        orchest.loadView(PipelineSettingsView, {"name": this.props.name, "uuid": this.props.uuid});
    }

    componentDidMount() {

        // get object positions from localStorage
        // TODO: serialize object positions

        fetch("/async/pipelines/json/get/" + this.props.uuid, {
           method: "GET",
           cache: "no-cache",
           redirect: "follow",
           referrer: "no-referrer"
        }).then(handleErrors).then((response) => {
            response.json().then((result) => {
                if(result.success){
                    this.decodeJSON(JSON.parse(result['pipeline_json']));
                }else{
                    console.warn("Could not load pipeline.json");
                    console.log(result);
                }
            })
        });

        // get backend status
        fetch("http://localhost:5000/api/launches/" + this.props.uuid, {
           method: "GET",
           cache: "no-cache",
           redirect: "follow",
           referrer: "no-referrer"
        }).then((response) => {
            if(response.status === 200){
                this.state.backend.running = true;
                this.setState({"backend": this.state.backend });

                return response
            }else{
                console.warn("Pipeline back-end is not live");
            }
        }).then((response) => {
            if(response){
                response.json().then((json) => {
                    console.log(json);

                    this.state.backend.server_ip = json.server_ip;
                    this.state.backend.server_info = json.server_info;

                    this.setState({"backend": this.state.backend});
                    this.updateJupyterInstance();
                })
            }
        });

        // new pipelineStep listener
        const newStepButtonMDC = new MDCRipple(this.refs.newStepButton);
        const encodeButton = new MDCRipple(this.refs.encodeButton);
        const settingsButtonRipple = new MDCRipple(this.refs.settingsButton);
        const powerButtonRipple = new MDCRipple(this.refs.powerButton);

    }

    updatePipelineViewerState(){
        // populate pipelineRefs
        this.pipelineRefs = [];

        for(let key in this.state.steps){
            if(this.state.steps.hasOwnProperty(key)){
                let step = this.state.steps[key];
                this.pipelineRefs.push(this.refs[step.uuid]);
            }
        }

        // create step object to store state related to rendering
        for(let x = 0; x < this.pipelineRefs.length; x++){
            let el = this.pipelineRefs[x].refs.container;
            let psdw = new PipelineStepDOMWrapper(el, $(el).attr('data-uuid'), this.pipelineRefs[x]);
            this.pipelineSteps[$(el).attr('data-uuid')] = psdw;
            psdw.restore();
            psdw.render();
        }
    }

    getConnectionByUUIDs(startNodeUUID, endNodeUUID){
        for(let x = 0; x < this.connections.length; x++){
            if(this.connections[x].startNodeUUID === startNodeUUID && this.connections[x].endNodeUUID === endNodeUUID){
                return this.connections[x];
            }
        }
    }

    createConnection(outgoingJEl, incomingJEl){
        // create a new element that represents the connection (svg image)
        let connectionHolder = document.createElement("div");
        $(connectionHolder).addClass('connection');

        let newConnection = new ConnectionDOMWrapper(connectionHolder, outgoingJEl, incomingJEl, this);
        this.connections.push(newConnection);

        if(!incomingJEl){
            this.newConnection = newConnection;
        }

        newConnection.render();

        $(this.refs.pipelineStepsHolder).append(connectionHolder);
    }

    initializePipeline(){

        // Initialize should be called only once
        // this.state.steps is assumed to be populated
        // called after render, assumed dom elements are also available (required by i.e. connections)

        console.log("Initializing pipeline listeners");

        let _this = this;

        $(this.refs.pipelineStepsHolder).on("mousedown", ".pipeline-step", function(e) {
            if(!$(e.target).hasClass('connection-point')){
                _this.selectedItem = _this.pipelineSteps[$(e.currentTarget).attr('data-uuid')];
            }
            _this.prevPosition = [e.clientX, e.clientY];
        });

        $(document).on("mouseup", function(e){
            if(_this.selectedItem){
                // check if click should be triggered

                // TODO: check if save pipeline needs to be triggered on every mouserelease
                _this.selectedItem.save();

                if(!_this.selectedItem.dragged){
                    _this.selectedItem.reactRef.props.onClick(_this.selectedItem.uuid);
                }

                _this.selectedItem.dragged = false;
            }
            _this.selectedItem = undefined;

            if(_this.newConnection){
                if($(e.target).hasClass("incoming-connections")){
                    // newConnection
                    _this.newConnection.setEndNode($(e.target));

                    let startNodeUUID = _this.newConnection.startNode.parents(".pipeline-step").attr('data-uuid');
                    let endNodeUUID = $(e.target).parents(".pipeline-step").attr('data-uuid');

                    _this.refs[endNodeUUID].props.onConnect(startNodeUUID, endNodeUUID);
                    _this.newConnection.render();

                }else{
                    _this.newConnection.el.remove();
                    _this.connections.splice(_this.connections.indexOf(_this.newConnection),1);
                }
            }
            _this.newConnection = undefined;
        });


        $(this.refs.pipelineStepsHolder).on("mousedown", ".pipeline-step .outgoing-connections", function(e) {

            // create connection
            _this.createConnection($(e.target));

        });

        $(this.refs.pipelineStepsHolder).on("mousedown", (e) => {
            if(e.target === this.refs.pipelineStepsHolder){
                if(this.selectedConnection){
                    this.selectedConnection.deselectState();
                    this.selectedConnection = undefined;
                }
            }
        });

        $(this.refs.pipelineStepsHolder).on("mousedown", "#path", function(e) {

            if(_this.selectedConnection){
                _this.selectedConnection.deselectState();
            }

            let connection = $(this).parents("svg").parents(".connection");
            let startNodeUUID = connection.attr("data-start-uuid");
            let endNodeUUID = connection.attr("data-end-uuid");

            _this.selectedConnection = _this.getConnectionByUUIDs(startNodeUUID, endNodeUUID);

            _this.selectedConnection.selectState();

        });

        $(document).on("keyup", function(e){

            if(e.keyCode === 27){
                if(_this.selectedConnection){
                    _this.selectedConnection.deselectState();
                }
            }

            if(e.keyCode === 8){
                if(_this.selectedConnection){
                    e.preventDefault();

                    _this.removeConnection(_this.selectedConnection.startNodeUUID, _this.selectedConnection.endNodeUUID);
                    _this.connections.splice(_this.connections.indexOf(_this.selectedConnection), 1);
                    _this.selectedConnection.remove();
                }
            }

        });

        $(this.refs.pipelineStepsHolder).on('mousemove', function(e){

            if(_this.selectedItem){

                _this.selectedItem.dragged = true;

                let delta = [e.clientX - _this.prevPosition[0], e.clientY - _this.prevPosition[1]];

                _this.selectedItem.x += delta[0];
                _this.selectedItem.y += delta[1];

                _this.selectedItem.render();

                _this.prevPosition = [e.clientX, e.clientY];

                renderConnections(_this.connections);

            }
            else if(_this.newConnection){

                let position = correctedPosition(e.clientX, e.clientY, $('.pipeline-view'));

                _this.newConnection.xEnd = position.x;
                _this.newConnection.yEnd = position.y;

                _this.newConnection.render();

            }
        });


        // add all existing connections (this happens only at initialization - thus can be
        for(let key in this.state.steps){
            if(this.state.steps.hasOwnProperty(key)){
                let step = this.state.steps[key];

                for(let x = 0; x < step.incoming_connections.length; x++){
                    let startNodeUUID = step.incoming_connections[x];
                    let endNodeUUID = step.uuid;

                    let startNodeOutgoingEl = $(this.refs.pipelineStepsHolder)
                        .find(".pipeline-step[data-uuid='" + startNodeUUID + "'] .outgoing-connections");

                    let endNodeIncomingEl = $(this.refs.pipelineStepsHolder)
                        .find(".pipeline-step[data-uuid='" + endNodeUUID + "'] .incoming-connections");

                    if(startNodeOutgoingEl.length > 0 && endNodeIncomingEl.length > 0){
                        this.createConnection(startNodeOutgoingEl, endNodeIncomingEl);
                    }
                }
            }
        }

        this.pipelineListenersInitialized = true;
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

        // add listeners once state is initialized by decodeJSON
        if(this.state.steps !== undefined && Object.keys(this.state.steps).length > 0){

            // initialize pipeline after setting state in decodeJSON/setting up React components
            this.updatePipelineViewerState()

            // initliaze pipeline only once
            if(!this.pipelineListenersInitialized){
                this.initializePipeline();
            }
        }

    }

    updateJupyterInstance(){
        let baseAddress = "http://" + this.state.backend.server_ip + ":" + this.state.backend.server_info.port + "/";
        let token = this.state.backend.server_info.token;
        orchest.jupyter.updateJupyterInstance(baseAddress, token);
    }

    launchPipeline(){

        if(this.state.backend.booting){
            alert("Please wait, the pipeline is still booting");
            return
        }

        if(!this.state.backend.running){

            // send launch request to API

            // perform POST to save
            // TODO: replace hardcoded URL
            // TODO: replace hardcoded pipeline directory
            let userdir_pipeline = "/home/yannick/Documents/Orchest/orchest/orchest/userdir/pipelines/";

            let data = {
                "pipeline_uuid": this.props.uuid,
                "pipeline_dir": userdir_pipeline + this.props.uuid + "/"
            };

            this.state.backend.booting = true;
            this.setState({"backend": this.state.backend});

            fetch("http://localhost:5000/api/launches/", {
                method: 'POST',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow', // manual, *follow, error
                referrer: 'no-referrer', // no-referrer, *client
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(handleErrors).then((response) => {
                response.json().then((json) => {
                    console.log("API launch result");
                    console.log(json);

                    this.state.backend.running = true;
                    this.state.backend.booting = false;

                    this.state.backend.server_ip = json.server_ip;
                    this.state.backend.server_info = json.server_info;

                    this.setState({"backend": this.state.backend});

                    this.updateJupyterInstance();
                })
            });

        }else{

            fetch("http://localhost:5000/api/launches/" + this.props.uuid, {
                method: 'DELETE',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow', // manual, *follow, error
                referrer: 'no-referrer', // no-referrer, *client
            }).then(handleErrors).then((response) => {
                response.json().then((result) => {
                    console.log("API delete result");
                    console.log(result);

                    this.state.backend.running = false;
                    this.state.backend.booting = false;
                    this.setState({"backend": this.state.backend});
                })
            });

        }

    }

    newStep(){

        let pipelineStepsHolderJEl = $(this.refs.pipelineStepsHolder);

        let step = {
            "name": "",
            "uuid": uuidv4(),
            "incoming_connections": [],
            "file_path": ".ipynb",
            "image": {
                "image_name": "kernel-python-36-tensorflow-20",
                "display_name": "Python 3.6, TensorFlow 2.0"
            },
            "memory": "1024",
            "vcpus": "1",
            "gpus": "0",
            "experiment_json": "",
            "meta_data": {
                "position": [Math.min(pipelineStepsHolderJEl.width() / 2 / 2, 450), pipelineStepsHolderJEl.height()/2]
            }
        };

        this.state.steps[step.uuid] = step;

        this.setState({"steps": this.state.steps});

        this.selectStep(step.uuid);

    }

    selectStep(pipelineStepUUID){
        if(this.state.selectedStep){
            this.setState({"selectedStep": undefined});
        }

        this.setState({"selectedStep": pipelineStepUUID});
    }

    moveStep(pipelineStepUUID, x, y){
        this.state.steps[pipelineStepUUID].meta_data.position = [x, y];
    }

    stepNameUpdate(pipelineStepUUID, name){
        this.state.steps[pipelineStepUUID].name = name;
        this.setState({"steps": this.state.steps});
    }

    makeConnection(sourcePipelineStepUUID, targetPipelineStepUUID){
        if(this.state.steps[targetPipelineStepUUID].incoming_connections.indexOf(sourcePipelineStepUUID) === -1){
            this.state.steps[targetPipelineStepUUID].incoming_connections.push(sourcePipelineStepUUID);
        }
    }

    removeConnection(sourcePipelineStepUUID, targetPipelineStepUUID){
        let connectionIndex = this.state.steps[targetPipelineStepUUID].incoming_connections.indexOf(sourcePipelineStepUUID);
        if(connectionIndex !== -1){
            this.state.steps[targetPipelineStepUUID].incoming_connections.splice(connectionIndex, 1);
        }
    }

    onDetailsDelete(){
        let uuid = this.state.selectedStep;

        // also delete incoming connections that contain this uuid
        for(let key in this.state.steps){
            if(this.state.steps.hasOwnProperty(key)){
                let step = this.state.steps[key];

                let connectionIndex = step.incoming_connections.indexOf(uuid);
                if(connectionIndex !== -1){
                    step.incoming_connections.splice(connectionIndex, 1);

                    // also delete incoming connections from GUI
                    let connection = this.getConnectionByUUIDs(uuid, step.uuid);
                    this.connections.splice(this.connections.indexOf(connection), 1);
                    connection.remove();
                }

            }
        }

        // visually delete incoming connections from GUI
        let step = this.state.steps[uuid];
        for(let x = 0; x < step.incoming_connections.length; x++){

            let connection = this.getConnectionByUUIDs(step.incoming_connections[x], uuid);
            this.connections.splice(this.connections.indexOf(connection), 1);
            connection.remove();
        }

        delete this.state.steps[uuid];
        this.setState({"steps": this.state.steps, "selectedStep": undefined });
    }

    onOpenNotebook(pipelineDetailsComponent){
        orchest.jupyter.navigateTo(this.state.steps[this.state.selectedStep].file_path);
        orchest.showJupyter();
        orchest.headerBarComponent.setPipeline(this.props);
    }

    onSaveDetails(pipelineDetailsComponent){

        // update step state based on latest state of pipelineDetails component

        // step name
        let step = this.state.steps[pipelineDetailsComponent.props.step.uuid];

        step.name = pipelineDetailsComponent.inputName.value;
        step.file_path = pipelineDetailsComponent.inputFileName.value + pipelineDetailsComponent.selectFileType.value;
        step.image.image_name = pipelineDetailsComponent.selectKernel.value;
        step.image.display_name = $(pipelineDetailsComponent.selectKernel.selectedText_).text();
        step.memory = pipelineDetailsComponent.inputMemory.value;
        step.vcpus = pipelineDetailsComponent.selectVCPU.value;
        step.gpus = pipelineDetailsComponent.selectGPU.value;
        step.experiment_json = pipelineDetailsComponent.experimentJSON.value;

        // update steps in setState even though reference objects are directly modified - this propagates state updates
        // properly

        this.setState({"selectedStep": undefined, "steps": this.state.steps});
    }

    getPowerButtonClasses(){
        let classes = ["mdc-button", "mdc-button--raised"];

        if(this.state.backend.running){
            classes.push("active");
        }
        if(this.state.backend.booting){
            classes.push("booting");
        }

        return classes.join(" ");
    }

    render() {

        let pipelineSteps = [];

        for(let key in this.state.steps){
            if(this.state.steps.hasOwnProperty(key)){
                let step = this.state.steps[key];
                pipelineSteps.push(<PipelineStep
                    key={step.uuid}
                    step={step}
                    ref={step.uuid}
                    onConnect={this.makeConnection.bind(this)}
                    onMove={this.moveStep.bind(this)}
                    onClick={this.selectStep.bind(this)} />);
            }
        }

        return <div className={"pipeline-view"}>
            <div className={"pipeline-name"}>{this.props.name}</div>
            <div className={"pipeline-actions"}>

                <button ref={"powerButton"} onClick={this.launchPipeline.bind(this)} className={this.getPowerButtonClasses()}>
                    <div className="mdc-button__ripple"></div>
                    <i className="material-icons">power_settings_new</i>
                </button>

                <button ref={"newStepButton"} onClick={this.newStep.bind(this)} className="mdc-button mdc-button--raised">
                    <div className="mdc-button__ripple"></div>
                    <span className="mdc-button__label"><i className={"material-icons mdc-button__icon"}>add</i>NEW STEP</span>
                </button>

                <button ref={"encodeButton"} onClick={this.encodeJSON.bind(this)} className="mdc-button mdc-button--raised">
                    <div className="mdc-button__ripple"></div>
                    <span className="mdc-button__label">SAVE</span>
                </button>


                <button ref={"settingsButton"} onClick={this.openSettings.bind(this)} className="mdc-button mdc-button--raised">
                    <div className="mdc-button__ripple"></div>
                    <span className="mdc-button__label"><i className={"material-icons mdc-button__icon"}>settings_applications</i>Settings</span>
                </button>

            </div>

            <div className={"pipeline-steps-holder"} ref={"pipelineStepsHolder"}>

                {pipelineSteps}

                { (() => {
                    if (this.state.selectedStep){
                        return <PipelineDetails
                            onDelete={this.onDetailsDelete.bind(this)}
                            onNameUpdate={this.stepNameUpdate.bind(this)}
                            onSave={this.onSaveDetails.bind(this)}
                            onOpenNotebook={this.onOpenNotebook.bind(this)}
                            step={this.state.steps[this.state.selectedStep]} />
                    }
                })() }
            </div>
        </div>;
    }
}

export default PipelineView;
