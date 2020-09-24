import React from 'react';
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';

class DateTimeInput extends React.Component {

    constructor(props) {
        super(props);

        let date = new Date();
        this.state = {
            "timeValue": ("0" + date.getHours()).slice(-2) + ":" + ("0" + date.getMinutes()).slice(-2),
            "dateValue": date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
        }
    }

    getISOString(){
        return new Date(this.state.dateValue + " " + this.state.timeValue).toISOString()
    }

    render() {
        return <div className="datetime-input">
            <div>
                <MDCTextFieldReact label="Time" icon="schedule" value={this.state.timeValue} onChange={(value) => {this.setState({timeValue: value})}} onFocus={this.props.onFocus} />
            </div>
            <div>
                <MDCTextFieldReact label="Date" icon="event" value={this.state.dateValue} onChange={(value) => {this.setState({dateValue: value})}} onFocus={this.props.onFocus} />
            </div>
        </div>;
    }

}

export default DateTimeInput

