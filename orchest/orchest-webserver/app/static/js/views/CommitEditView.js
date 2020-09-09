import React, { Fragment } from 'react';
import MDCButtonReact from '../lib/mdc-components/MDCButtonReact';
import {Controlled as CodeMirror} from 'react-codemirror2'
import MDCTextFieldReact from '../lib/mdc-components/MDCTextFieldReact';
import { makeRequest, PromiseManager, makeCancelable } from '../lib/utils/all';
import CommitsView from './CommitsView';
import { XTerm } from 'xterm-for-react';
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
            },
        }

        this.promiseManager = new PromiseManager();
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
            this.refs.term.terminal.write(data.output);
        })
    }


    componentDidUpdate(prevProps){
        if(this.props.commit && this.props.commit.uuid != prevProps.commit.uuid){
            this.fetchShell();
        }
    }

    save(e){

        e.nativeEvent.preventDefault();

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

            this.setState({
                commit: this.state.commit
            })

            makeRequest("POST", "/async/commits/shell/" + this.state.commit.uuid, {
                type: "json",
                content: { 
                    "shell": this.state.commit.shell
                }
            }).then(() => {

                orchest.loadView(CommitsView, {image: this.props.image});

            }).catch((error) => {
                console.log(error);
            })

        }).catch((error) => {
            console.log(error);

            try {
                console.error(JSON.parse(error.body)["message"]);
            }catch (error){
                console.log(error);
                console.log("Couldn't get error message from response.");
            }
        })

    }

    onChangeName(value){
        this.state.commit.name = value;
    }

    buildCommit(){

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

                <XTerm ref='term' />

                <MDCButtonReact classNames={['mdc-button--raised', 'themed-secondary']} onClick={this.save.bind(this)} label="Save" icon="save" />
                <MDCButtonReact classNames={['mdc-button--raised']} onClick={this.buildCommit.bind(this)} label="Build" icon="memory" />
            </form>
            
        </div>;
    }
}

export default CommitEditView;