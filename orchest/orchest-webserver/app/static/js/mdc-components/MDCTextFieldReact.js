import React from 'react';
import { MDCTextField } from '@material/textfield';
import {uuidv4} from '../utils/all';

class MDCTextFieldReact extends React.Component {

    componentDidMount() {
        this.mdc = new MDCTextField(this.refs.input);
        this.mdc.value = this.getValue();
    }

    onChange(){
        if(this.mdc.value !== this.props.value && this.props.onChange){
            this.props.onChange(this.mdc.value)
        }
    }

    getValue(){
        return this.props.value ? this.props.value : "";
    }
    
    focus(){
        this.mdc.focus();
    }

    componentDidUpdate(prevProps){

        if(prevProps.value !== this.props.value){
            this.mdc.value = this.getValue();
        }
    }

    render() {

        let randomFor = uuidv4();

        let topClasses = ["mdc-text-field"];

        let formType = "text";

        if(this.props.password === true){
            formType = "password";
        }

        if(this.props.disabled === true){
            topClasses.push("mdc-text-field--disabled");
        }

        if(this.props.classNames){
            topClasses = topClasses.concat(this.props.classNames)
        }

        return <div ref={"input"} className={topClasses.join(" ")}>
            <input disabled={this.props.disabled} onChange={this.onChange.bind(this)} className="mdc-text-field__input"
                type={formType}
                id={randomFor} />
            <label className="mdc-floating-label" htmlFor={randomFor}>{this.props.label}</label>
            <div className="mdc-line-ripple"></div>
        </div>;
    }
}

export default MDCTextFieldReact;