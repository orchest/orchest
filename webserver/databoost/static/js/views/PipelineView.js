import React from 'react';
import {MDCSelect} from '@material/select';
import {MDCRipple} from '@material/ripple';

import {handleErrors, uuidv4} from "../utils/all";

class PipelineStep extends React.Component {
    render() {
        return <div data-uuid={this.props.uuid} ref={"container"} className={"pipeline-step"}>
            <div className={"incoming-connections connection-point"}>

            </div>
            <div className={"step-label"}>
                {this.props.name}
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

    componentDidMount() {

        const select = new MDCSelect(this.refs.selectFile);
        select.listen('MDCSelect:change', () => {
          alert(`Selected option at index ${select.selectedIndex} with value "${select.value}"`);
        });


        const selectKernel = new MDCSelect(this.refs.selectKernel);
        selectKernel.listen('MDCSelect:change', () => {
          alert(`Selected option at index ${selectKernel.selectedIndex} with value "${selectKernel.value}"`);
        });

        const selectVCPU = new MDCSelect(this.refs.selectVCPU);
        selectVCPU.listen('MDCSelect:change', () => {
          alert(`Selected option at index ${selectVCPU.selectedIndex} with value "${selectVCPU.value}"`);
        });


        const buttonRipple = new MDCRipple(this.refs.saveButton);
    }

    render() {
        return <div className={"pipeline-details"}>
            <h3>Step: { this.props.name }</h3>

            <div className={"multi-field-input"}>
                <div className="mdc-text-field mdc-text-field--fullwidth">
                    <input onChange={this.changeFileName}  className="mdc-text-field__input"
                           type="text"
                           placeholder="my_file_name"
                           aria-label="my_file_name" />
                </div>
                <div className="mdc-select" ref={"selectFile"}>
                    <div className="mdc-select__anchor demo-width-class">
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
                        <li className="mdc-list-item" data-value="kernel-python-36-tensorflow-20">
                            Python 3.6, TensorFlow 2.0
                        </li>
                        <li className="mdc-list-item" data-value="kernel-r-331">
                            R 3.3.1
                        </li>
                    </ul>
                </div>
            </div>

            <h3>Compute resources</h3>

            <div className="mdc-select" ref={"selectVCPU"}>
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
                            2 vCPU
                        </li>
                        <li className="mdc-list-item" data-value="4">
                            4 vCPU
                        </li>
                    </ul>
                </div>
            </div>

            <label>
                Memory (in MiB)
                <div className="mdc-text-field mdc-text-field--fullwidth">
                    <input onChange={this.changeMemory}  className="mdc-text-field__input"
                       type="number"
                       placeholder="1024"
                       aria-label="my_file_name" />
                </div>
            </label>

            <button ref={"saveButton"} onClick={this.props.onSave} className="mdc-button mdc-button--raised save-button">
                <div className="mdc-button__ripple"></div>
                <span className="mdc-button__label">Save</span>
            </button>
        </div>
    }
}



function ConnectionDOMWrapper(el, startNode){

    this.startNode = startNode;
    this.endNode = undefined;

    this.x = 0;
    this.y = 0;

    // initialize xEnd and yEnd at startNode position
    let startNodePosition = nodeCenter(this.startNode);
    startNodePosition = correctedPosition(startNodePosition.x, startNodePosition.y, $('.pipeline-view'));
    this.xEnd = startNodePosition.x;
    this.yEnd = startNodePosition.y;

    this.svgPadding = 5;
    this.arrowWidth = 7;

    this.el = $(el);
    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg" ,"svg");
    this.svgPath = document. createElementNS("http://www.w3.org/2000/svg", "path");
    this.svgPath.setAttribute("stroke", "black");
    this.svgPath.setAttribute("stroke-width", "2");
    this.svgPath.setAttribute("fill", "none");
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
    }
}

function PipelineStepDOMWrapper(el, uuid, reactRef){
    this.el = $(el);
    this.uuid = uuid;
    this.reactRef = reactRef;
    this.x = 0;
    this.y = 0;
    this.dragged = false;

    this.restore = function () {
        let ls = localStorage.getItem("PipelineStepDOMWrapper"+uuid);
        if(ls != null){
            let xy = JSON.parse(ls);
            this.x = xy[0];
            this.y = xy[1];
        }
    };

    this.render = function(){
        this.el.css('transform', "translateX("+this.x+"px) translateY("+this.y+"px)");
    };

    this.save = function () {
        localStorage.setItem("PipelineStepDOMWrapper"+uuid, JSON.stringify([this.x, this.y]));
    }
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
            "steps": []
        };

        for(let x = 0; x < this.state.steps.length; x++){
            let step = this.state.steps;

            pipelineJSON["steps"].push(step);
        }

        console.log(pipelineJSON);

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
        // initialize React components based on incomin JSON description of the pipeline
        console.log(jsonPipeline)

        // add steps to the state
        let steps = this.state.steps;

        for(let x = 0; x < jsonPipeline.steps.length; x++){
            steps.push(jsonPipeline.steps[x]);
        }

        this.setState({"steps": steps});
    }

    constructor(props) {
        super(props);

        this.state = {
            selectedStep: undefined,
            steps: []
        }
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
                this.decodeJSON(JSON.parse(result['pipeline_json']));

                // initialize pipeline after setting state in decodeJSON/setting up React components
                this.initializePipeline()
            })
        });

        // new pipelineStep listener
        const newStepButtonMDC = new MDCRipple(this.refs.newStepButton);
        const encodeButton = new MDCRipple(this.refs.encodeButton);
        const decodeButton = new MDCRipple(this.refs.decodeButton);

    }

    initializePipeline(){
        let selectedItem = undefined;
        let activeConnection = undefined;
        let connections = [];

        let pipelineSteps = {};

        let pipelineRefs = [this.refs.ps1, this.refs.ps2, this.refs.ps3];

        for(let x = 0; x < pipelineRefs.length; x++){
            let el = pipelineRefs[x].refs.container;
            let psdw = new PipelineStepDOMWrapper(el, $(el).attr('data-uuid'), pipelineRefs[x]);
            pipelineSteps[$(el).attr('data-uuid')] = psdw;
            psdw.restore();
            psdw.render();
        }

        // listener on items
        let prevPosition = [];
        $(this.refs.pipelineStepsHolder).on("mousedown", ".pipeline-step", function (e) {
            if(!$(e.target).hasClass('connection-point')){
                selectedItem = pipelineSteps[$(e.currentTarget).attr('data-uuid')];
            }

            prevPosition = [e.clientX, e.clientY];
        });

        $(document).on("mouseup", function(e){
            if(selectedItem){
                // check if click should be triggered
                selectedItem.save();

                if(!selectedItem.dragged){
                    selectedItem.reactRef.props.onClick(selectedItem.reactRef);
                }

                selectedItem.dragged = false;
            }
            selectedItem = undefined;

            if(activeConnection){
                // TODO: handle release of new connection creation
                // alert("releasing");
                console.log("releasing");


                if($(e.target).hasClass("incoming-connections")){
                    // activeConnection
                    activeConnection.endNode = $(e.target);
                    activeConnection.render();
                }else{
                    activeConnection.el.remove();
                    connections.splice(connections.indexOf(activeConnection),1);
                }
            }
            activeConnection = undefined;
        });


        $(document).on("mousedown", ".pipeline-step .outgoing-connections", function (e) {

            // create a new element that represents the connection (svg image)
            let connectionHolder = document.createElement("div");
            connectionHolder.classList.add('connection');

            activeConnection = new ConnectionDOMWrapper(connectionHolder, $(e.target));
            connections.push(activeConnection);
            activeConnection.render();

            $(this).parents('.pipeline-steps-holder').append(connectionHolder);

        });

        $(this.refs.pipelineStepsHolder).on('mousemove', function(e){

            if(selectedItem){

                selectedItem.dragged = true;

                let delta = [e.clientX - prevPosition[0], e.clientY - prevPosition[1]];

                selectedItem.x += delta[0];
                selectedItem.y += delta[1];

                selectedItem.render();

                prevPosition = [e.clientX, e.clientY];

                renderConnections(connections);

            }
            else if(activeConnection){

                let position = correctedPosition(e.clientX, e.clientY, $('.pipeline-view'));

                activeConnection.xEnd = position.x;
                activeConnection.yEnd = position.y;

                activeConnection.render();

            }
        });
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }

    newStep(){
        alert("Add new pipeline step");

        let step = {
            "name": "",
            "uuid": uuidv4(),
            "incoming_connections": [],
            "file_path": "",
            "image": {
                "image_name": "",
                "display_name": ""
            },
            "memory": "",
            "vcpus": "",
            "meta_data": {
                "position": [0, 0]
            }
        };

        this.state.steps[step.uuid] = step;

        this.setState({"steps": this.state.steps});

        this.selectStep(step.uuid);

    }

    selectStep(pipelineStepUUID){
        this.setState({"selectedStep": pipelineStepUUID});
    }

    onSaveDetails(){
        this.setState({"selectedStep": undefined});
    }

    render() {
        
        let pipelineSteps = [];
        
        for(let x = 0; x < this.state.steps.length; x++){
            let step = this.state.steps[x];
            pipelineSteps.push(<PipelineStep ref={"ps" + x} uuid={step.uuid} name={step.name} onClick={this.selectStep.bind(this)} />);
        }
        
        return <div className={"pipeline-view"}>
            <div className={"pipeline-name"}>{this.props.name}</div>
            <div className={"pipeline-actions"}>
                <button ref={"newStepButton"} onClick={this.newStep.bind(this)} className="mdc-button mdc-button--raised">
                    <div className="mdc-button__ripple"></div>
                    <span className="mdc-button__label"><i className={"material-icons mdc-button__icon"}>add</i> NEW STEP</span>
                </button>

                <button ref={"encodeButton"} onClick={this.encodeJSON.bind(this)} className="mdc-button mdc-button--raised">
                    <div className="mdc-button__ripple"></div>
                    <span className="mdc-button__label">ENCODE</span>
                </button>

                <button ref={"decodeButton"} onClick={this.decodeJSON.bind(this)} className="mdc-button mdc-button--raised">
                    <div className="mdc-button__ripple"></div>
                    <span className="mdc-button__label">DECODE</span>
                </button>
            </div>

            <div className={"pipeline-steps-holder"} ref={"pipelineStepsHolder"}>

                
                {pipelineSteps}

                { (() => {
                    if (this.state.selectedStep){
                        return <PipelineDetails onSave={this.onSaveDetails.bind(this)} stepUuid={this.state.selectedStep} name={this.state.steps[this.state.selectedStep].name} />
                    }
                })() }
            </div>
        </div>;
    }
}

export default PipelineView;