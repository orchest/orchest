import React from 'react';
import {MDCSelect} from '@material/select';
import {MDCRipple} from '@material/ripple';

class PipelineStep extends React.Component {
    render() {
        return <div data-guid={this.props.guid} ref={"container"} className={"pipeline-step"}>{this.props.name}</div>
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


function PipelineStepDOMWrapper(el, guid, reactRef){
    this.el = $(el);
    this.guid = guid;
    this.reactRef = reactRef;
    this.x = 0;
    this.y = 0;
    this.dragged = false;

    this.restore = function () {
        let ls = localStorage.getItem("PipelineStepDOMWrapper"+guid);
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
        localStorage.setItem("PipelineStepDOMWrapper"+guid, JSON.stringify([this.x, this.y]));
    }
}



class PipelineView extends React.Component {

    componentWillUnmount() {
    }

    constructor(props) {
        super(props);

        this.state = {
            selectedStep: undefined
        }
    }

    componentDidMount() {

        // get object positions from localStorage
        // TODO: serialize object positions

        let selectedItem = undefined;

        let pipelineSteps = {};

        let pipelineRefs = [this.refs.ps1, this.refs.ps2, this.refs.ps3];

        for(let x = 0; x < pipelineRefs.length; x++){
            let el = pipelineRefs[x].refs.container;
            let psdw = new PipelineStepDOMWrapper(el, $(el).attr('data-guid'), pipelineRefs[x]);
            pipelineSteps[$(el).attr('data-guid')] = psdw;
            psdw.restore();
            psdw.render();
        }

        // listener on items
        let prevPosition = [];
        $(this.refs.pipelineStepsHolder).on("mousedown", ".pipeline-step", function (e) {
            selectedItem = pipelineSteps[$(e.target).attr('data-guid')];
            prevPosition = [e.clientX, e.clientY];
        });

        $(document).on("mouseup", ".pipeline-step", function (e) {
            if(selectedItem){
                // check if click should be triggered
                selectedItem.save();

                if(!selectedItem.dragged){
                    selectedItem.reactRef.props.onClick(selectedItem.reactRef);
                }

                selectedItem.dragged = false;
            }
            selectedItem = undefined;
        });

        $(this.refs.pipelineStepsHolder).on('mousemove', function(e){
            if(selectedItem){

                selectedItem.dragged = true;

                let delta = [e.clientX - prevPosition[0], e.clientY - prevPosition[1]];

                selectedItem.x += delta[0];
                selectedItem.y += delta[1];

                selectedItem.render();

                prevPosition = [e.clientX, e.clientY];
            }
        });

    }

    componentDidUpdate(prevProps, prevState, snapshot) {
    }

    selectStep(pipelineStep){
        this.setState({"selectedStep": pipelineStep});
    }

    onSaveDetails(){
        this.setState({"selectedStep": undefined});
    }

    render() {
        return <div className={"pipeline-view"}>
            <div className={"pipeline-name"}>{this.props.name}</div>

            <div className={"pipeline-steps-holder"} ref={"pipelineStepsHolder"}>
                <PipelineStep ref={"ps1"} guid={"iahijijaij"} name={"Preprocessing"} onClick={this.selectStep.bind(this)} />
                <PipelineStep ref={"ps2"} guid={"9f98jafjie"} name={"Modeling"} onClick={this.selectStep.bind(this)} />
                <PipelineStep ref={"ps3"} guid={"oji3fao9j3"} name={"Visualization"} onClick={this.selectStep.bind(this)} />

                { (() => {
                    if (this.state.selectedStep){
                        return <PipelineDetails onSave={this.onSaveDetails.bind(this)} name={this.state.selectedStep.props.name} />
                    }
                })() }
            </div>
        </div>;
    }
}

export default PipelineView;