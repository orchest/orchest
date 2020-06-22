import React from 'react';
import { MDCSelect } from '@material/select';

class MDCSelectReact extends React.Component {
    componentWillUnmount() {
    }

    componentDidMount() {
        this.mdc = new MDCSelect(this.refs.select);
        this.mdc.value = this.props.value;

        this.mdc.listen("MDCSelect:change", () => {
            if (this.mdc.value !== this.props.value) {
                if(this.props.onChange){
                    this.props.onChange(this.mdc.value);
                }
            }
        })

    }

    componentDidUpdate(prevProps){

        if(prevProps.value !== this.props.value){
            this.mdc.value = this.props.value;
        }
    }

    render() {

        let listItems = this.props.options.map((item, key) => {
            // if only single entry is passed instead of value, display value
            if(item.length == 0){
                item[1] = item[0];
            }

            return <li key={key} className="mdc-list-item" data-value={item[0]}>
                {item[1]}
            </li>;
        })

        let topClasses = ["mdc-select"];

        if(this.props.disabled){
            topClasses.push("mdc-select--disabled");
        }

        if (this.props.classNames) {
            topClasses = topClasses.concat(this.props.classNames)
        }

        return <div className={topClasses.join(" ")} ref="select">
            <div className="mdc-select__anchor" aria-disabled={this.props.disabled}>
                <i className="mdc-select__dropdown-icon"></i>
                <div className="mdc-select__selected-text"></div>
                <span className="mdc-floating-label">{this.props.label}</span>
                <div className="mdc-line-ripple"></div>
            </div>

            <div className="mdc-select__menu mdc-menu mdc-menu-surface demo-width-class">
                <ul className="mdc-list">
                    {listItems}
                </ul>
            </div>
        </div>;
    }
}

export default MDCSelectReact;