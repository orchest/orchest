import React from 'react';
import {MDCSelect} from "@material/select";
import {MDCRipple} from "@material/ripple";
import {MDCDataTable} from "@material/data-table";

class ExperimentsView extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            "pipelines": [],
            "creating": false,
            "selectedPipelineUUID": "",
            "filterMap": {}
        }

    }

    componentDidMount() {
        // request pipelines
        this.selectPipeline = new MDCSelect(this.refs.selectPipeline);

        this.selectPipeline.listen("MDCSelect:change", (e) => {
            this.setState({
                selectedPipelineUUID: this.selectPipeline.value
            });
        });

        this.fetchList()
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.refs.newExperimentButton) {
            new MDCRipple(this.refs.newExperimentButton);
        }

        if (this.refs.closeButton) {
            new MDCRipple(this.refs.closeButton);
        }

        if(this.refs.experimentTable){
            new MDCDataTable(this.refs.experimentTable);
        }

    }

    fetchList() {
        // initialize REST call for pipelines
        fetch('/async/pipelines').then((response) => {
            response.json().then((data) => {

                this.setState({
                    pipelines: data.result,
                });

            })
        })
    }

    componentWillUnmount() {
    }

    cancelNewExperiment() {
        this.setState({
            "creating": false
        });
    }

    newExperiment() {


        if (this.state.selectedPipelineUUID === "") {
            alert("Please select a pipeline first.");

            return;
        }
        fetch('/async/pipelines/json/experiments/' + this.state.selectedPipelineUUID).then((response) => {
            response.json().then((data) => {
                this.setState({
                    experiment_args: data.experiment_args,
                    creating: true
                });

            })
        })


    }

    setMap(mapKey) {
        if (this.state.filterMap[mapKey]) {
            delete this.state.filterMap[mapKey];
        } else {
            this.state.filterMap[mapKey] = true;
        }
        this.setState({
            filterMap: this.state.filterMap
        })
    }

    render() {

        let renderedPipelines = [];

        for (let x = 0; x < this.state.pipelines.length; x++) {
            renderedPipelines.push(
                <li key={x} className="mdc-list-item" data-value={this.state.pipelines[x].uuid}>
                    {this.state.pipelines[x].name}
                </li>
            );
        }

        return <div className={"view-page"}>
            <div className="mdc-select" ref={"selectPipeline"}>
                <div className="mdc-select__anchor demo-width-class">
                    <i className="mdc-select__dropdown-icon"></i>
                    <div className="mdc-select__selected-text"></div>
                    <span className="mdc-floating-label">Choose a pipeline</span>
                    <div className="mdc-line-ripple"></div>
                </div>

                <div className="mdc-select__menu mdc-menu mdc-menu-surface demo-width-class">
                    <ul className="mdc-list">
                        {renderedPipelines}
                    </ul>
                </div>
            </div>

            {(() => {
                if (this.state.creating) {

                    let steps = [];

                    let stepUUIDs = Object.keys(this.state.experiment_args);
                    for (let x = 0; x < stepUUIDs.length; x++) {
                        let stepArgs = this.state.experiment_args[stepUUIDs[x]];

                        let experimentArgs = Object.keys(stepArgs["experiment_json"]);

                        let args = [];
                        for (let y = 0; y < experimentArgs.length; y++) {

                            let argValueElements = [];

                            for (let i = 0; i < stepArgs["experiment_json"][experimentArgs[y]].length; i++) {
                                let argValue = stepArgs["experiment_json"][experimentArgs[y]][i];

                                let mapKey = stepArgs["name"] + ":" + experimentArgs[y] + ":" + argValue;

                                argValueElements.push(
                                    <span onClick={this.setMap.bind(this, mapKey)}
                                          className={this.state.filterMap[mapKey] ? "" : "selected"} key={i}>
                                        {argValue}
                                    </span>
                                )
                            }

                            args.push(<div key={y} className={"argument-set"}>
                                <div className={"argument-label"}>{experimentArgs[y]}</div>
                                <div className={"argument-values"}> {argValueElements} </div>
                            </div>)
                        }

                        steps.push(
                            <div key={x}>
                                <b>{stepArgs["name"]}</b>
                                {args}
                            </div>
                        )
                    }


                    return <div className={"new-experiment"}>
                        <h2 className={"header"}>New experiment
                            <button ref={"closeButton"} onClick={this.cancelNewExperiment.bind(this)}
                                    className={"close-button mdc-button mdc-button--raised"}>
                                <div className="mdc-button__ripple"></div>
                                <i className="material-icons">close</i>
                            </button>
                        </h2>

                        <div className={"steps"}>
                            {steps}
                        </div>

                    </div>;
                } else {
                    return <div className={"experiment-list"}>
                        <h2 className={"header"}>Experiments
                            <button ref={"newExperimentButton"} onClick={this.newExperiment.bind(this)}
                                    className="experiment-button mdc-button mdc-button--raised">
                                <div className="mdc-button__ripple"></div>
                                <span className="mdc-button__label"><i
                                    className={"material-icons mdc-button__icon"}>add</i>Create new experiment</span>
                            </button>
                        </h2>

                        <div className="mdc-data-table" ref={"experimentTable"}>
                            <table className="mdc-data-table__table" aria-label="Dessert calories">
                                <thead>
                                <tr className="mdc-data-table__header-row">
                                    <th className="mdc-data-table__header-cell mdc-data-table__header-cell--numeric" role="columnheader" scope="col">ID</th>
                                    <th className="mdc-data-table__header-cell mdc-data-table__header-cell--numeric"
                                        role="columnheader" scope="col">Date
                                    </th>
                                    <th className="mdc-data-table__header-cell mdc-data-table__header-cell--numeric"
                                        role="columnheader" scope="col">Pipeline version
                                    </th>
                                    <th className="mdc-data-table__header-cell" role="columnheader" scope="col">Experiment arguments
                                    </th>
                                    <th className="mdc-data-table__header-cell" role="columnheader"
                                        scope="col">Note
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="mdc-data-table__content">
                                    {/* <tr className="mdc-data-table__row">
                                        <td className="mdc-data-table__cell mdc-data-table__cell--numeric">#1</td>
                                        <td className="mdc-data-table__cell mdc-data-table__cell--numeric">6 Jan, 2020 at 13:07</td>
                                        <td className="mdc-data-table__cell mdc-data-table__cell--numeric">1.01</td>
                                        <td className="mdc-data-table__cell "></td>
                                        <td className="mdc-data-table__cell">first try</td>
                                    </tr> */}
                                </tbody>
                            </table>
                        </div>
                    </div>;
                }
            })()}


        </div>;
    }
}

export default ExperimentsView;