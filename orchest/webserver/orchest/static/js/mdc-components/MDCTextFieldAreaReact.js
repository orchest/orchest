import React from 'react';
import { MDCTextField } from '@material/textfield';
import {uuidv4} from '../utils/all';

class MDCTextFieldAreaReact extends React.Component {
    componentWillUnmount() {
    }

    componentDidMount() {
        this.mdc = new MDCTextField(this.refs.input);
        this.mdc.value = this.props.value;
    }

    onChange(){
        this.props.onChange(this.mdc.value)
    }
    render() {

        let randomFor = uuidv4();

        let topClasses = ["mdc-text-field", "mdc-text-field--textarea"];
        if(this.props.classNames){
            topClasses = topClasses.concat(this.props.classNames)
        }

        return <div ref="input" className={topClasses.join(" ")}>
            <textarea id={randomFor} onChange={this.onChange.bind(this)} className="mdc-text-field__input" rows="5"></textarea>
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