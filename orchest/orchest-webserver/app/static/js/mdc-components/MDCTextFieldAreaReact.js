import React from 'react';
import { MDCTextField } from '@material/textfield';
import {uuidv4} from '../utils/all';

class MDCTextFieldAreaReact extends React.Component {
    componentWillUnmount() {
    }


    getValue(){
        return this.props.value ? this.props.value : "";
    }

    componentDidMount() {
        this.mdc = new MDCTextField(this.refs.input);
        this.mdc.value = this.getValue();
    }

    onChange(){
        if(this.mdc.value !== this.getValue() && this.props.onChange){
            this.props.onChange(this.mdc.value)
        }
    }
    render() {

        if(this.mdc){
            this.mdc.value = this.getValue();
        }

        let randomFor = uuidv4();

        let topClasses = ["mdc-text-field", "mdc-text-field--textarea"];

        if(this.props.disabled){
            topClasses.push("mdc-text-field--disabled");
        }

        if(this.props.classNames){
            topClasses = topClasses.concat(this.props.classNames)
        }

        return <div ref="input" className={topClasses.join(" ")}>
            <textarea disabled={this.props.disabled} id={randomFor} onChange={this.onChange.bind(this)} className="mdc-text-field__input" rows="5"></textarea>
            <div className="mdc-notched-outline">
                <div className="mdc-notched-outline__leading"></div>
                <div className="mdc-notched-outline__notch">
                    <label htmlFor={randomFor} className="mdc-floating-label">{this.props.label}</label>
                </div>
                <div className="mdc-notched-outline__trailing"></div>
            </div>
        </div>;
    }
}

export default MDCTextFieldAreaReact;