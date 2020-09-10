import React, { Fragment } from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import {Controlled as CodeMirror} from 'react-codemirror2'
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import { makeRequest, PromiseManager, makeCancelable } from '../lib/utils/all';
import CommitsView from './CommitsView';
import { XTerm } from 'xterm-for-react';
import { FitAddon } from 'xterm-addon-fit';

import io from 'socket.io-client';

require('codemirror/mode/shell/shell');

class CommitEditView extends React.Component {

    componentWillUnmount() {
        if(this.socket){
            this.socket.close();
        }
    }

    constructor(props) {
        super(props);

        this.state = {
            "newCommit": props.commit === undefined,
            "commit": props.commit ? props.commit : {
                "uuid": "new",
                "name": "", 
                "tag": "",
                "shell": "#!/bin/bash\n\n# Install any dependencies you have in this shell script.\n\n# E.g. pip install tensorflow\n\n\n",
            }           
        }

        this.promiseManager = new PromiseManager();

        // initialize Xterm addons
        this.fitAddon = new FitAddon();
    }

    fetchShell(){

        let fetchShellPromise = makeCancelable(makeRequest("GET", "/async/commits/shell/" + this.state.commit.uuid), this.promiseManager)
        
        fetchShellPromise.promise.then((response) => {
            
            let result = JSON.parse(response);

            this.state.commit.shell = result.shell;

            this.setState({
                "commit": this.state.commit
            })

        }).catch((error) => {
            console.log(error);
        })
        
    }

    componentDidMount(){
        this.fetchShell();
        this.connectSocketIO();
    }

    connectSocketIO(){

        // disable polling
        this.socket = io.connect("/pty", {"transports": ['websocket']});

        this.socket.on('connect', () => {
            console.log("SocketIO connected on /pty");
        })

        this.socket.on("pty-output", (data) => {
            
            // ignore terminal outputs from other commit uuid's
            if(data.commit_uuid == this.state.commit.uuid){
                this.refs.term.terminal.write(data.output);
            }
        })
    }

    resizeTerminal(){
        console.log('resized terminal')
        this.socket.emit("resize", {
            "rows": this.refs.term.terminal.rows,
            "cols": this.refs.term.terminal.cols,
            "commit_uuid": this.state.commit.uuid
        })
    }

    componentDidUpdate(prevProps){
        if(this.props.commit && this.props.commit.uuid != prevProps.commit.uuid){
            this.fetchShell();
        }

        this.fitAddon.fit();
    }

    build(e){

        e.nativeEvent.preventDefault();

        this.refs.term.terminal.clear()

        this.savePromise().then(() => {
            let method = "POST";
            let commitEndpoint = "/async/commits/build/" + this.state.commit.uuid;
    
            makeRequest(method, commitEndpoint, {type: 'json', content: {
                'rows': this.refs.term.terminal.rows,
                'cols': this.refs.term.terminal.cols,
            }}).then((response) => {
            }).catch((error) => {
                console.log(error);
            })
        })

    }


    savePromise(){

        return new Promise((resolve, reject) => {
            let method = "POST";
            let commitEndpoint = "/store/commits/" + this.state.commit.uuid;

            if(this.state.newCommit === false){
                method = "PUT";
            }

            makeRequest(method, commitEndpoint, {type: 'json', content: {
                "name": this.state.commit.name,
                "image_name": this.props.image.name,
            }}).then((response) => {

                let result = JSON.parse(response);

                this.state.commit.uuid = result.uuid;

                makeRequest("POST", "/async/commits/shell/" + this.state.commit.uuid, {
                    type: "json",
                    content: { 
                        "shell": this.state.commit.shell
                    }
                }).then(() => {

                    resolve();

                }).catch((error) => {
                    console.log(error);
                    reject();
                })

            }).catch((error) => {
                console.log(error);

                try {
                    console.error(JSON.parse(error.body)["message"]);
                }catch (error){
                    console.log(error);
                    console.log("Couldn't get error message from response.");
                }

                reject();
            })
        })
        
    }

    save(e){

        e.nativeEvent.preventDefault();
        
        this.savePromise().then(() => {
            orchest.loadView(CommitsView, {image: this.props.image});
        })
    }

    onChangeName(value){
        this.state.commit.name = value;
    }

    render() {

        
        return <div className={"view-page edit-commit"}>
            <h2>Edit commit</h2>

            <form className="commit-form">
                {(() => {
                    if(this.state.commit.uuid !== 'new'){
                        return <span className="commit-uuid">{ this.state.commit.uuid }</span>
                    }   
                })()}

                <MDCTextFieldReact classNames={["push-down"]} label="Base image" disabled value={this.props.image.name} />
                <MDCTextFieldReact classNames={["push-down"]} label="Commit name" value={this.state.commit.name} onChange={this.onChangeName.bind(this)} />
                
                <CodeMirror
                    value={
                        this.state.commit.shell
                    }
                    options={{
                        mode: 'application/x-sh',
                        theme: 'default',
                        lineNumbers: true, 
                        viewportMargin: Infinity
                    }}
                    onBeforeChange={(editor, data, value) => {
                        this.state.commit.shell = value;
                        
                        this.setState({
                            commit: this.state.commit
                        })

                    }}
                />

                <XTerm addons={[this.fitAddon]} ref='term' onResize={this.resizeTerminal.bind(this)} />

                <MDCButtonReact classNames={['mdc-button--raised', 'themed-secondary']} onClick={this.save.bind(this)} label="Save" icon="save" />
                <MDCButtonReact classNames={['mdc-button--raised']} onClick={this.build.bind(this)} label="Build" icon="memory" />
            </form>
            
        </div>;
    }
}

export default CommitEditView;