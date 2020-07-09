import React from 'react';
import MDCTabBarReact from '../mdc-components/MDCTabBarReact';
import MDCButtonReact from '../mdc-components/MDCButtonReact';
import MDCTextFieldReact from '../mdc-components/MDCTextFieldReact';
import MDCDataTableReact from '../mdc-components/MDCDataTableReact';
import ParameterEditor from '../components/ParameterEditor';
import DateTimeInput from '../components/DateTimeInput';
import Radio, { NativeRadioControl } from '@material/react-radio';
import ExperimentsView from "./ExperimentsView";
import SearchableTable from '../components/SearchableTable';

class CreateExperimentView extends React.Component {

    constructor(props) {
        super(props);

        let parameterizedSteps = {};
        for (const stepUUID in this.props.pipeline.steps) {
            let parameterizedStep = JSON.parse(
                JSON.stringify(this.props.pipeline.steps[stepUUID])
            );

            if (parameterizedStep.parameters && 
                Object.keys(parameterizedStep.parameters).length > 0) {
                for (const paramKey in parameterizedStep.parameters) {

                    // Note: the list of parameters for each key will always be
                    // a string in the 'parameterizedSteps' data structure. This
                    // facilitates preserving user added indendation.

                    // Validity of the user string as JSON is checked client
                    // side (for now).
                    parameterizedStep.parameters[paramKey] =
                        JSON.stringify([parameterizedStep.parameters[paramKey]]);
                }

                parameterizedSteps[stepUUID] = parameterizedStep;
            }
        }

        this.state = {
            'selectedTabIndex': 0,
            'parameterizedSteps': parameterizedSteps,
            'generatedPipelineRuns': [],
            'selectedIndices': [],
            'scheduleOption': 'now',
        }

    }

    onSelectSubview(index) {
        this.setState({
            selectedTabIndex: index
        })
    }

    componentDidMount(){
        this.onParameterChange();
    }

    onParameterChange(){

        // flatten and JSONify parameterizedSteps to prep data structure for algo
        let flatParameters = {};
        
        for(const stepUUID in this.state.parameterizedSteps){
            for(const paramKey in this.state.parameterizedSteps[stepUUID].parameters){
                let fullParam = stepUUID + "#" +  paramKey;

                flatParameters[fullParam] = JSON.parse(
                    this.state.parameterizedSteps[stepUUID].parameters[paramKey]
                );
            }
        }

        let recursivelyGenerate = function(params, accum, unpacked){

            // deep clone unpacked
            unpacked = JSON.parse(JSON.stringify(unpacked));

            for(const fullParam in params){
                if(unpacked.indexOf(fullParam) === -1){

                    unpacked.push(fullParam);

                    for(const idx in params[fullParam]){

                        // deep clone params
                        let localParams = JSON.parse(JSON.stringify(params));

                        // collapse param list to paramValue
                        localParams[fullParam] = params[fullParam][idx];

                        recursivelyGenerate(localParams, accum, unpacked)
                    }
                    return
                }
            }

            accum.push(params);
        }

        let pipelineRuns = [];

        recursivelyGenerate(flatParameters, pipelineRuns, []);

        // transform pipelineRuns for generatedPipelineRuns DataTable format
        let generatedPipelineRuns = [];

        for(let idx in pipelineRuns){
            let params = pipelineRuns[idx];

            let pipelineRunRow = [];

            for(let fullParam in params){
                let paramName = fullParam.split("#").slice(1).join("");
                pipelineRunRow.push(paramName + ": " + params[fullParam])
            }

            generatedPipelineRuns.push([pipelineRunRow.join(", ")]);
        }

        let selectedIndices = Array(generatedPipelineRuns.length).fill(1);

        this.setState({
            generatedPipelineRuns: generatedPipelineRuns,
            selectedIndices: selectedIndices
        })
    }

    runPipelines(){

    }

    cancel(){
        orchest.loadView(ExperimentsView);
    }

    onPipelineRunsSelectionChanged(selectedRows, rows){

        // map selectedRows to selectedIndices
        let selectedIndices = this.state.selectedIndices;

        // for indexOf to work on arrays in this.generatedPipelineRuns it
        // depends on the object being the same (same reference)
        for(let x = 0; x < rows.length; x++){
            let index = this.state.generatedPipelineRuns.indexOf(rows[x]);
            
            if(selectedRows.indexOf(rows[x]) !== -1){
                selectedIndices[index] = 1;
            }else{
                selectedIndices[index] = 0;
            }
        }

        this.setState({
            selectedIndices: selectedIndices
        })
    }

    render() {

        let tabView = undefined;

        switch (this.state.selectedTabIndex) {
            case 0:
                tabView = <ParameterEditor 
                    onParameterChange={this.onParameterChange.bind(this)} 
                    parameterizedSteps={this.state.parameterizedSteps} />
                break;
            case 1:
                tabView = <div className='tab-view'>
                    <div>
                        <Radio label='Now' key='now'>
                            <NativeRadioControl
                                name='time'
                                id="now"
                                value='now'
                                checked={this.state.scheduleOption === "now"}
                                onChange={(e) => {
                                    this.setState({ scheduleOption: e.target.value })}}
                            />
                        </Radio>
                    </div>
                    <div>
                        <Radio label='Scheduled' key='scheduled'>
                            <NativeRadioControl
                                name='time'
                                id="scheduled"
                                value='scheduled'
                                checked={this.state.scheduleOption === "scheduled"}
                                onChange={(e) => {
                                    this.setState({ scheduleOption: e.target.value })}}
                            />
                        </Radio>

                        <DateTimeInput 
                            onFocus={() => this.setState({ scheduleOption: 'scheduled' })} />

                    </div>
                </div>
                break;
            case 2:
                tabView = <div className="pipeline-tab-view">
                    <SearchableTable 
                        selectable={true}
                        headers={['Parameters']} 
                        rows={this.state.generatedPipelineRuns} 
                        selectedIndices={this.state.selectedIndices} 
                        onSelectionChanged={this.onPipelineRunsSelectionChanged.bind(this)} />
                </div>
                break;
        }

        return <div className="view-page experiment-view">
            <div className="columns top-labels">
                <div className="column">
                    <label>Experiment</label>
                    <h3>{this.props.experiment.name}</h3>
                </div>
                <div className="column">
                    <label>Pipeline</label>
                    <h3>{this.props.pipeline.name}</h3>
                </div>
            </div>

            <MDCTabBarReact
                selectedIndex={this.state.selectedTabIndex}
                ref={"tabBar"}
                items={[
                    'Parameters',
                    'Scheduling',
                    'Pipeline runs (' + 
                    this.state.selectedIndices.reduce((total, num) => total + num, 0) + 
                    "/" + 
                    this.state.generatedPipelineRuns.length + ")",
                ]}
                icons={[
                    'tune',
                    'schedule',
                    'list',
                ]}
                onChange={this.onSelectSubview.bind(this)}
            />

            <div className="tab-view">
                {tabView}
            </div>

            <div className="buttons">
                <MDCButtonReact classNames={["mdc-button--raised"]} onClick={this.runPipelines.bind(this)} icon="play_arrow" label="Run pipelines" />
                <MDCButtonReact onClick={this.cancel.bind(this)} label="Cancel" icon="close" />
            </div>
        </div>;

    }
}

export default CreateExperimentView;