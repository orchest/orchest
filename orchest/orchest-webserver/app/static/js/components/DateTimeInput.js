import React from 'react';
import TextField, { Input } from '@material/react-text-field';
import MaterialIcon from '@material/react-material-icon';

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
                <TextField
                    label='Time'
                    trailingIcon={<MaterialIcon role="button" icon="schedule" />}
                >
                    <Input
                        value={this.state.timeValue}
                        onChange={(e) => this.setState({ timeValue: e.currentTarget.value })}
                        onFocus={this.props.onFocus} />
                </TextField>
            </div>
            <div>
                <TextField
                    label='Date'
                    trailingIcon={<MaterialIcon role="button" icon="event" />}
                >
                    <Input
                        value={this.state.dateValue}
                        onChange={(e) => this.setState({ dateValue: e.currentTarget.value })}
                        onFocus={this.props.onFocus} />
                </TextField>
            </div>
        </div>;
    }

}

export default DateTimeInput

