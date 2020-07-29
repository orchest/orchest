import React from 'react';
import MDCDialogReact from '../mdc-components/MDCDialogReact';
import MDCButtonReact from '../mdc-components/MDCButtonReact';

class AlertDialog extends React.Component {

    close(){
        this.refs.dialog.close();
    }

    render() {

        return <MDCDialogReact 
            ref="dialog"
            title={this.props.title}
            onClose={this.props.onClose}
            content={<p>{this.props.content}</p>}
            actions={<MDCButtonReact label="Ok" onClick={this.close.bind(this)} />}
        />
    }

}

export default AlertDialog