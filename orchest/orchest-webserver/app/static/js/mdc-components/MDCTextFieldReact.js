import React from 'react';
import { MDCTextField } from '@material/textfield';
import {uuidv4} from '../utils/all';

class MDCTextFieldReact extends React.Component {

    componentDidMount() {
        this.mdc = new MDCTextField(this.refs.input);
        this.mdc.value = this.props.value;
    }

    onChange(){
        if(this.mdc.value !== this.props.value){
            this.props.onChange(this.mdc.value)
        }
    }
    
    focus(){
        this.mdc.focus();
    }

    render() {

        if(this.mdc){
            this.mdc.value = this.props.value;
        }

        let randomFor = uuidv4();

        let topClasses = ["mdc-text-field"];
        if(this.props.classNames){
            topClasses = topClasses.concat(this.props.classNames)
        }

        return <div ref={"input"} className={topClasses.join(" ")}>
            <input onChange={this.onChange.bind(this)} className="mdc-text-field__input"
                type="text"
                id={randomFor} />
            <label className="mdc-floating-label" htmlFor={randomFor}>{this.props.label}</label>
            <div className="mdc-line-ripple"></div>
        </div>;
    }
}

export default MDCTextFieldReact;