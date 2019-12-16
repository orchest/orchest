import React from 'react';
import {MDCSelect} from '@material/select';
import {MDCRipple} from '@material/ripple';

class PipelineStep extends React.Component {
    render() {
        return <div onClick={this.props.onClick.bind(undefined, this)} className={"pipeline-step"}>{this.props.name}</div>
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

            <div className={"pipeline-steps-holder"}>
                <PipelineStep name={"Preprocessing"} onClick={this.selectStep.bind(this)} />
                <PipelineStep name={"Modeling"} onClick={this.selectStep.bind(this)} />
                <PipelineStep name={"Visualization"} onClick={this.selectStep.bind(this)} />

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