import React, { Fragment } from 'react';
import {Controlled as CodeMirror} from 'react-codemirror2'
require('codemirror/mode/javascript/javascript');

class ParameterEditor extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            "parameterizedSteps": this.props.parameterizedSteps,
            "activeParameter": undefined
        }
    }

    truncateParameterValue(value){
        let maxLength = 50;
        return value.length > maxLength ? value.substring(0, maxLength - 1) + "…" : value
    }

    editParameter(key, uuid){        
        this.setState({
            activeParameter: {"key": key, "uuid": uuid}
        })
    }

    generateParameterStep(parameterizedStep){
        let elements = [];

        elements.push(<b key={parameterizedStep.uuid}>{parameterizedStep.title}</b>);

        for(let parameterKey in parameterizedStep.parameters){
            elements.push(<div key={parameterKey + "-" + parameterizedStep.uuid} className="parameter-row">
                <div className='parameter-key'>
                    {parameterKey}:
                </div>
                <div className='parameter-value' onClick={this.editParameter.bind(this, parameterKey, parameterizedStep.uuid)}>
                    {this.truncateParameterValue(
                        parameterizedStep.parameters[parameterKey]
                    )}
                </div>
            </div>)
        }

        return elements;
    }

    generateParameterTree(parameterizedSteps){
        let elements = [];
        
        for(const stepUUID in parameterizedSteps){
            elements = elements.concat(this.generateParameterStep(parameterizedSteps[stepUUID]));
        }

        return elements;
    }

    render() {

        let treeView = this.generateParameterTree(this.state.parameterizedSteps);
        
        return <div className='parameter-editor tab-view'>
            <div className="columns">
                <div className="column">
                    {treeView}
                </div>
                <div className="column">
                    {(() => {
                        if(this.state.activeParameter !== undefined){
                            return <Fragment>
                                <CodeMirror 
                                    value={
                                        this.state.parameterizedSteps[this.state.activeParameter.uuid].parameters[this.state.activeParameter.key]
                                    }
                                    options={{
                                        mode: 'application/json',
                                        theme: 'default',
                                        lineNumbers: true
                                    }}
                                    onBeforeChange={(editor, data, value) => {
                                        this.state.parameterizedSteps[this.state.activeParameter.uuid].parameters[this.state.activeParameter.key] = value;
                                        
                                        this.setState({
                                            parameterizedSteps: this.state.parameterizedSteps
                                        })

                                        // only call onParameterChange if valid JSON Array
                                        try {
                                            if(Array.isArray(JSON.parse(value))){
                                                this.props.onParameterChange()
                                            }
                                        } catch {
                                            console.warn("Invalid JSON entered")
                                        }
                                    }}
                                />
                                {(() => {
                                    try {
                                        JSON.parse(this.state.parameterizedSteps[this.state.activeParameter.uuid].parameters[this.state.activeParameter.key])
                                    }catch {
                                        return <div className="json-warning"><i className="material-icons">warning</i> Your input is not valid JSON.</div>
                                    }
                                })()}
                            </Fragment>
                        }
                    })()}
                </div>
            </div>
            
        </div>;
    }
}

export default ParameterEditor;