import React from 'react';
import MDCDialogReact from '../lib/mdc-components/MDCDialogReact';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import { RefManager } from '../lib/utils/all';

class AlertDialog extends React.Component {

    constructor(){
        super();

        this.refManager = new RefManager();
    }

    close(){
        this.refManager.refs.dialogRef.close();
    }

    render() {

        return <MDCDialogReact 
            ref={this.refManager.nrefs.dialogRef}
            title={this.props.title}
            onClose={this.props.onClose}
            content={<p>{this.props.content}</p>}
            actions={<MDCButtonReact label="Ok" onClick={this.close.bind(this)} />}
        />
    }

}

export default AlertDialog