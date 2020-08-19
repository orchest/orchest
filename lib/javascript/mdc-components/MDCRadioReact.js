import React from 'react';
import {MDCFormField} from '@material/form-field';
import {MDCRadio} from '@material/radio';
import { uuidv4 } from '../utils/all';

class MDCRadioReact extends React.Component {
    componentDidMount() {
        this.mdcField =new MDCFormField(this.refs.formField);
        this.mdc = new MDCRadio(this.refs.radio);
    }

    onChange(e){
        if(this.props.onChange){
            this.props.onChange(e);
        }
    }

    render() {

        let topClasses = ["mdc-form-field"]; 

        if (this.props.classNames) {
            topClasses = topClasses.concat(this.props.classNames)
        }
        topClasses = topClasses.join(" ");
        let randomFor = uuidv4();

        return <div className={topClasses} ref="formField">
            <div className="mdc-radio" ref="radio">
                <input onChange={this.onChange.bind(this)} className="mdc-radio__native-control" type="radio" value={this.props.value} id={"radio-" + randomFor} name={this.props.name} checked={this.props.checked} />
                <div className="mdc-radio__background">
                    <div className="mdc-radio__outer-circle"></div>
                    <div className="mdc-radio__inner-circle"></div>
                </div>
                <div className="mdc-radio__ripple"></div>
            </div>
            <label htmlFor={"radio-" + randomFor}>{this.props.label}</label>
        </div>
    }
}

export default MDCRadioReact;