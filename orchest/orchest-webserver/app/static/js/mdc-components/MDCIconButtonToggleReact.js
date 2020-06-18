import React from 'react';
import {MDCIconButtonToggle} from '@material/icon-button';

class MDCIconButtonToggleReact extends React.Component {
    componentDidMount() {
        this.mdc = new MDCIconButtonToggle(this.refs.button);

        this.mdc.listen("MDCIconButtonToggle:change", (e) => {
            this.props.onClick();
        });
    }

    click(){
        this.mdc.activate();
        if(this.props.onClick){
            this.props.onClick();
        }
        this.mdc.deactivate();
    }
    
    render() {
        return <button ref={"button"} className="mdc-icon-button material-icons">{this.props.icon}</button>;
    }
}

export default MDCIconButtonToggleReact;