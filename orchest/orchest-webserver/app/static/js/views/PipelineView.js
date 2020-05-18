import React from 'react';
import { MDCRipple } from '@material/ripple';

import { handleErrors, uuidv4, intersectRect, globalMDCVars } from "../utils/all";
import PipelineSettingsView from "./PipelineSettingsView";
import PipelineDetails from "./PipelineDetails";
import PipelineStep from "./PipelineStep";
import MDCButtonReact from "../mdc-components/MDCButtonReact";


function ConnectionDOMWrapper(el, startNode, endNode, pipelineView) {

    this.startNode = startNode;
    this.endNode = endNode;

    this.x = 0;
    this.y = 0;

    this.pipelineView = pipelineView;

    // initialize xEnd and yEnd at startNode position
    let startNodePosition = nodeCenter(this.startNode);
    startNodePosition = correctedPosition(startNodePosition.x, startNodePosition.y, $('.pipeline-view'));
    this.xEnd = startNodePosition.x;
    this.yEnd = startNodePosition.y;

    this.svgPadding = 5;
    this.arrowWidth = 7;

    this.el = $(el);

    this.remove = function () {
        this.el.remove();
    };

    this.setStartNode = function (startNodeJEl) {
        this.startNode = startNodeJEl;
        if (startNodeJEl) {
            this.startNodeUUID = this.startNode.parents(".pipeline-step").attr("data-uuid");
            this.el.attr("data-start-uuid", this.startNodeUUID);
        }
    };

    this.setEndNode = function (endNodeJEl) {
        this.endNode = endNodeJEl;
        if (endNodeJEl) {
            this.endNodeUUID = this.endNode.parents(".pipeline-step").attr("data-uuid");
            this.el.attr("data-end-uuid", this.endNodeUUID);
        }
    };

    this.selectState = function () {
        $(this.svgPath).attr("stroke", globalMDCVars()['mdcthemesecondary']);
        this.el.addClass("selected");
        $(this.svgPath).attr("stroke-width", 3);
    };

    this.deselectState = function () {
        this.el.removeClass("selected");
        $(this.svgPath).attr("stroke", "black");
        $(this.svgPath).attr("stroke-width", 2);
    };

    this.setStartNode(this.startNode);
    this.setEndNode(this.endNode);

    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    this.svgPath.setAttribute("stroke", "black");
    this.svgPath.setAttribute("stroke-width", "2");
    this.svgPath.setAttribute("fill", "none");
    this.svgPath.setAttribute("id", "path");
    this.svgEl.appendChild(this.svgPath);

    this.el.append(this.svgEl);

    this.render = function () {

        let startNodePosition = nodeCenter(this.startNode);
        startNodePosition = correctedPosition(startNodePosition.x, startNodePosition.y, $('.pipeline-view'));
        this.x = startNodePosition.x;
        this.y = startNodePosition.y;


        // set xEnd and yEnd if endNode is defined

        if (this.endNode) {
            let endNodePosition = nodeCenter(this.endNode);
            endNodePosition = correctedPosition(endNodePosition.x, endNodePosition.y, $('.pipeline-view'));
            this.xEnd = endNodePosition.x;
            this.yEnd = endNodePosition.y;
        }

        let targetX = this.xEnd - this.x;
        let targetY = this.yEnd - this.y;

        let xOffset = 0;
        let yOffset = 0;

        if (targetX < 0) {
            xOffset = targetX
        }
        if (targetX < this.arrowWidth * 10) {
            this.el.addClass("flipped-horizontal");
        } else {
            this.el.removeClass("flipped-horizontal");
        }

        if (targetY < 0) {
            yOffset = targetY;
            this.el.addClass("flipped");
        } else {
            this.el.removeClass("flipped");
        }

        this.el.css('transform', "translateX(" + (this.x - this.svgPadding + xOffset + this.pipelineView.pipelineOffset[0]) + "px) translateY(" + (this.y - this.svgPadding + yOffset + this.pipelineView.pipelineOffset[1]) + "px)");

        // update svg poly line
        this.svgEl.setAttribute("width", (Math.abs(targetX) + 2 * this.svgPadding) + "px");
        this.svgEl.setAttribute("height", (Math.abs(targetY) + 2 * this.svgPadding) + "px");

        this.svgPath.setAttribute('d', this.curvedHorizontal(this.svgPadding - xOffset,
            this.svgPadding - yOffset,
            this.svgPadding + targetX - xOffset - this.arrowWidth,
            this.svgPadding + targetY - yOffset));
    };

    this.curvedHorizontal = function (x1, y1, x2, y2) {
        let line = [];
        let mx = x1 + (x2 - x1) / 2;

        line.push('M', x1, y1);
        line.push('C', mx, y1, mx, y2, x2, y2);

        return line.join(' ')
    };
}

function PipelineStepDOMWrapper(el, uuid, reactRef) {
    this.el = $(el);
    this.uuid = uuid;
    this.reactRef = reactRef;
    this.x = 0;
    this.y = 0;
    this.dragged = false;
    this.dragCount = 0;

    this.restore = function () {
        this.x = this.reactRef.props.step.meta_data.position[0];
        this.y = this.reactRef.props.step.meta_data.position[1];
    };

    this.render = function () {
        this.el.css('transform', "translateX(" + this.x + "px) translateY(" + this.y + "px)");
    };

    this.save = function () {
        this.reactRef.props.onMove(this.uuid, this.x, this.y);
    };
}

function nodeCenter(el) {

    let position = {};

    position.x = el.offset().left + el.width() / 2;
    position.y = el.offset().top + el.height() / 2;

    return position;
}

function correctedPosition(x, y, el) {
    let elementOffset = el.offset();
    let position = {};
    position.x = x - elementOffset.left;
    position.y = y - elementOffset.top;
    return position;
}

function renderConnections(connections) {
    for (let x = 0; x < connections.length; x++) {
        connections[x].render();
    }
}

class PipelineView extends React.Component {

    componentWillUnmount() {
        $(document).off("mouseup.initializePipeline");
        $(document).off("keyup.initializePipeline");
        $(document).off("keydown.initializePipeline");
    }

    savePipeline() {

        let pipelineJSON = this.encodeJSON();

        // store pipeline.json
        let formData = new FormData();
        formData.append("pipeline_json", JSON.stringify(pipelineJSON));
        formData.append("pipeline_uuid", pipelineJSON.uuid);

        // perform POST to save
        fetch("/async/pipelines/json/save", {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: formData
        });

        this.setState({
            "unsavedChanges": false
        })

    }

    encodeJSON() {
        // generate JSON representation using the internal state of React components describing the pipeline
        let pipelineJSON = {
            "name": this.state.pipelineJson.name,
            "uuid": this.props.pipeline.uuid,
            "steps": {}
        };

        for (let key in this.state.steps) {
            if (this.state.steps.hasOwnProperty(key)) {
                let step = this.state.steps[key];
                pipelineJSON["steps"][step.uuid] = step;
            }
        }

        return pipelineJSON;
    }

    decodeJSON(pipelineJson) {
        // initialize React components based on incoming JSON description of the pipeline

        // add steps to the state
        let steps = this.state.steps;

        for (let key in pipelineJson.steps) {
            if (pipelineJson.steps.hasOwnProperty(key)) {
                steps[key] = pipelineJson.steps[key];
            }
        }

        // in addition to creating steps explicitly in the React state, also attach full pipelineJson
        this.setState({ "steps": steps, "pipelineJson": pipelineJson });
    }

    getPipelineJSON() {
        this.state.pipelineJson.steps = this.state.steps;
        return this.state.pipelineJson;
    }

    constructor(props) {
        super(props);

        // class constants
        this.STATUS_POLL_FREQUENCY = 1000;
        this.DRAG_CLICK_SENSITIVITY = 3;

        this.selectedItem = undefined;
        this.selectedConnection = undefined;

        // newConnection is for creating a new connection
        this.newConnection = undefined;

        this.keysDown = {};
        this.draggingPipeline = false;
        this.pipelineOffset = [0, 0];

        this.connections = [];
        this.pipelineSteps = {};
        this.pipelineRefs = [];
        this.prevPosition = [];
        this.pipelineListenersInitialized = false;
        this.pipelineStepStatusPollingInterval = undefined;

        this.state = {
            openedStep: undefined,
            selectedSteps: [],
            runUuid: undefined,
            unsavedChanges: false,
            stepSelector: {
                active: false,
                x1: 0,
                y1: 0,
                x2: 0,
                y2: 0,
            },
            showSelectionButton: false,
            pipelineRunning: false,
            stepExecutionState: {},
            steps: {},
            defaultDetailViewIndex: 0,
            backend: {
                running: false,
                working: false
            }
        }

    }

    openSettings() {
        orchest.loadView(PipelineSettingsView, { "pipeline": this.props.pipeline });
    }

    componentDidMount() {

        fetch("/async/pipelines/json/get/" + this.props.pipeline.uuid, {
            method: "GET",
            cache: "no-cache",
            redirect: "follow",
            referrer: "no-referrer"
        }).then(handleErrors).then((response) => {
            response.json().then((result) => {
                if (result.success) {
                    this.decodeJSON(JSON.parse(result['pipeline_json']));
                    
                    orchest.headerBarComponent.setPipeline(this.state.pipelineJson);
                } else {
                    console.warn("Could not load pipeline.json");
                    console.log(result);
                }
            })
        });

        // get backend status
        fetch("/api-proxy/api/launches/" + this.props.pipeline.uuid, {
            method: "GET",
            cache: "no-cache",
            redirect: "follow",
            referrer: "no-referrer"
        }).then((response) => {
            if (response.status === 200) {
                this.state.backend.running = true;
                this.setState({ "backend": this.state.backend });

                return response
            } else {
                console.warn("Pipeline back-end is not live");
            }
        }).then((response) => {
            if (response) {
                response.json().then((json) => {
                    console.log(json);

                    this.state.backend.server_ip = json.server_ip;
                    this.state.backend.server_info = json.server_info;

                    this.setState({ "backend": this.state.backend });
                    this.updateJupyterInstance();
                })
            }
        });

    }

    updatePipelineViewerState() {
        // populate pipelineRefs
        this.pipelineRefs = [];

        for (let key in this.state.steps) {
            if (this.state.steps.hasOwnProperty(key)) {
                let step = this.state.steps[key];
                this.pipelineRefs.push(this.refs[step.uuid]);
            }
        }

        // create step object to store state related to rendering
        for (let x = 0; x < this.pipelineRefs.length; x++) {
            let el = this.pipelineRefs[x].refs.container;
            let psdw = new PipelineStepDOMWrapper(el, $(el).attr('data-uuid'), this.pipelineRefs[x]);
            this.pipelineSteps[$(el).attr('data-uuid')] = psdw;
            psdw.restore();
            psdw.render();
        }
    }

    getConnectionByUUIDs(startNodeUUID, endNodeUUID) {
        for (let x = 0; x < this.connections.length; x++) {
            if (this.connections[x].startNodeUUID === startNodeUUID && this.connections[x].endNodeUUID === endNodeUUID) {
                return this.connections[x];
            }
        }
    }

    createConnection(outgoingJEl, incomingJEl) {
        // create a new element that represents the connection (svg image)
        let connectionHolder = document.createElement("div");
        $(connectionHolder).addClass('connection');

        let newConnection = new ConnectionDOMWrapper(connectionHolder, outgoingJEl, incomingJEl, this);
        this.connections.push(newConnection);

        if (!incomingJEl) {
            this.newConnection = newConnection;
        }

        newConnection.render();

        $(this.refs.pipelineStepsHolder).append(connectionHolder);
    }

    willCreateCycle(startNodeUUID, endNodeUUID) {

        // add connection temporarily
        let insertIndex = this.state.steps[endNodeUUID].incoming_connections.push(startNodeUUID) - 1;

        // augment incoming_connections with outgoing_connections to be able to traverse from root nodes

        // reset outgoing_connections state (creates 2N algorithm, but makes for guaranteerd clean state.steps data structure)
        for (let step_uuid in this.state.steps) {
            if (this.state.steps.hasOwnProperty(step_uuid)) {
                this.state.steps[step_uuid].outgoing_connections = [];
            }
        }

        for (let step_uuid in this.state.steps) {
            if (this.state.steps.hasOwnProperty(step_uuid)) {
                let incoming_connections = this.state.steps[step_uuid].incoming_connections;
                for (let x = 0; x < incoming_connections.length; x++) {
                    this.state.steps[incoming_connections[x]].outgoing_connections.push(step_uuid);
                }
            }
        }


        let whiteSet = new Set(Object.keys(this.state.steps));
        let greySet = new Set();

        let cycles = false;

        while (whiteSet.size > 0) {
            // take first element left in whiteSet
            let step_uuid = whiteSet.values().next().value;

            if (this.dfsWithSets(step_uuid, whiteSet, greySet)) {
                cycles = true;
            }
        }

        // remote temp connection
        this.state.steps[endNodeUUID].incoming_connections.splice(insertIndex, 1);

        return cycles;
    }

    dfsWithSets(step_uuid, whiteSet, greySet) {
        // move from white to grey
        whiteSet.delete(step_uuid);
        greySet.add(step_uuid);

        for (let x = 0; x < this.state.steps[step_uuid].outgoing_connections.length; x++) {
            let child_uuid = this.state.steps[step_uuid].outgoing_connections[x];

            if (whiteSet.has(child_uuid)) {
                if (this.dfsWithSets(child_uuid, whiteSet, greySet)) {
                    return true;
                }
            }
            else if (greySet.has(child_uuid)) {
                return true;
            }
        }

        // move from grey to black
        greySet.delete(step_uuid);
    }

    initializePipeline() {

        // Initialize should be called only once
        // this.state.steps is assumed to be populated
        // called after render, assumed dom elements are also available (required by i.e. connections)

        console.log("Initializing pipeline listeners");

        let _this = this;

        $(this.refs.pipelineStepsHolder).on("mousedown", ".pipeline-step", function (e) {

            if (e.button === 0) {

                if (!$(e.target).hasClass('connection-point')) {

                    let stepUUID = $(e.currentTarget).attr('data-uuid');

                    _this.selectedItem = _this.pipelineSteps[stepUUID];



                }
                _this.prevPosition = [e.clientX, e.clientY];

            }

        });

        $(document).on("mouseup.initializePipeline", function (e) {

            let dragOp = false;

            if (_this.selectedItem) {
                // check if click should be triggered

                // TODO: check if save pipeline needs to be triggered on every mouserelease

                // Saving pipeline step position on mouse release.
                // two cases: moved selectedItem or moved this.state.selectedSteps
                if (_this.state.selectedSteps.length > 1) {
                    for (let key in _this.state.selectedSteps) {
                        let uuid = _this.state.selectedSteps[key];
                        _this.pipelineSteps[uuid].save();
                    }
                } else {
                    _this.selectedItem.save();
                }

                // on move step trigger unsavedChanges
                _this.setState({
                    "unsavedChanges": _this.state.unsavedChanges
                });

                if (!_this.selectedItem.dragged) {
                    // also select this step only
                    _this.selectedItem.reactRef.props.onClick(_this.selectedItem.uuid);
                    _this.selectStep(_this.selectedItem.uuid);

                } else {
                    dragOp = true;
                }

                _this.selectedItem.dragged = false;
                _this.selectedItem.dragCount = 0;
            }
            _this.selectedItem = undefined;

            if (_this.newConnection) {

                let endNodeUUID = $(e.target).parents(".pipeline-step").attr('data-uuid');
                let startNodeUUID = _this.newConnection.startNode.parents(".pipeline-step").attr('data-uuid');

                // check whether drag release was on .incomming-connections class
                let dragEndedInIcomingConnectionsElement = $(e.target).hasClass("incoming-connections");
                let noConnectionExists = true;

                // check whether there already exists a connection
                if (dragEndedInIcomingConnectionsElement) {
                    noConnectionExists = _this.refs[endNodeUUID].props.step.incoming_connections.indexOf(startNodeUUID) === -1;
                }

                // check whether connection will create a cycle in Pipeline graph
                let connectionCreatesCycle = false;
                if (noConnectionExists && dragEndedInIcomingConnectionsElement) {
                    connectionCreatesCycle = _this.willCreateCycle(startNodeUUID, endNodeUUID);
                }

                if (connectionCreatesCycle) {
                    alert("Error: Connecting this step will create a cycle in your pipeline which is not supported.");
                }

                if (dragEndedInIcomingConnectionsElement && noConnectionExists && !connectionCreatesCycle) {

                    // newConnection
                    _this.newConnection.setEndNode($(e.target));
                    _this.refs[endNodeUUID].props.onConnect(startNodeUUID, endNodeUUID);
                    _this.newConnection.render();

                } else {
                    _this.newConnection.el.remove();
                    _this.connections.splice(_this.connections.indexOf(_this.newConnection), 1);
                }
            }
            _this.newConnection = undefined;

            if (_this.draggingPipeline) {
                _this.draggingPipeline = false;
            }

            // stepSelector
            if (_this.state.stepSelector.active) {
                // if single step is selected open pane
                if (_this.state.selectedSteps.length == 1) {
                    let selectedStep = _this.state.selectedSteps[0];
                    if (_this.state.openedStep !== selectedStep && !dragOp) {
                        // TODO: evaluate whether dragOp can open a step
                        // _this.selectStep(selectedStep);
                    }
                }

                _this.state.stepSelector.active = false;
                _this.setState({
                    stepSelector: _this.state.stepSelector
                });

                _this.onSelectionChanged();
            }


            // always force update (due to center button)
            _this.forceUpdate();

        });


        $(this.refs.pipelineStepsHolder).on("mousedown", ".pipeline-step .outgoing-connections", function (e) {

            if (e.button === 0) {

                // create connection
                _this.createConnection($(e.target));

            }


        });

        $(this.refs.pipelineStepsHolder).on("mousedown", (e) => {

            if (e.button === 0) {
                if (e.target === this.refs.pipelineStepsHolder) {
                    if (this.selectedConnection) {
                        this.deselectConnection();
                    }

                    this.deselectSteps();
                }
            }

        });

        $(this.refs.pipelineStepsHolder).on("mousedown", "#path", function (e) {

            if (e.button === 0) {
                if (_this.selectedConnection) {
                    _this.selectedConnection.deselectState();
                }

                let connection = $(this).parents("svg").parents(".connection");
                let startNodeUUID = connection.attr("data-start-uuid");
                let endNodeUUID = connection.attr("data-end-uuid");

                _this.selectedConnection = _this.getConnectionByUUIDs(startNodeUUID, endNodeUUID);

                _this.selectedConnection.selectState();
            }

        });

        $(document).on("keydown.initializePipeline", function (e) {

            // Ctrl / Meta + S for saving pipeline
            if (e.keyCode == 83 && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();

                _this.refs.saveButton.click();
                // _this.encodeButton.activate();
                // _this.encodeButton.deactivate();
                // _this.refs.encodeButton.click();
                // TODO: fix save button after React component swap
            }
            if(e.keyCode == 72){
                _this.centerView();
            }

            _this.keysDown[e.keyCode] = true;

        });

        $(document).on("keyup.initializePipeline", function (e) {

            _this.keysDown[e.keyCode] = false;

            if (e.keyCode) {
                $(_this.refs.pipelineStepsOuterHolder).removeClass("dragging");
                this.draggingPipeline = false;
            }

            if (e.keyCode === 27) {
                if (_this.selectedConnection) {

                    _this.deselectConnection();
                }

                _this.deselectSteps();
            }

            if (e.keyCode === 8) {
                if (_this.selectedConnection) {
                    e.preventDefault();

                    _this.removeConnection(_this.selectedConnection.startNodeUUID, _this.selectedConnection.endNodeUUID);
                    _this.connections.splice(_this.connections.indexOf(_this.selectedConnection), 1);
                    _this.selectedConnection.remove();
                }
            }

        });

        $(this.refs.pipelineStepsHolder).on('mousemove', function (e) {

            if (_this.selectedItem) {

                let delta = [e.clientX - _this.prevPosition[0], e.clientY - _this.prevPosition[1]];

                _this.selectedItem.dragCount++;
                if (_this.selectedItem.dragCount >= _this.DRAG_CLICK_SENSITIVITY) {
                    _this.selectedItem.dragged = true;
                    _this.selectedItem.dragCount = 0;
                }

                if (_this.state.selectedSteps.length > 1) {
                    for (let key in _this.state.selectedSteps) {
                        let uuid = _this.state.selectedSteps[key];

                        _this.pipelineSteps[uuid].x += delta[0];
                        _this.pipelineSteps[uuid].y += delta[1];
                        _this.pipelineSteps[uuid].render();
                    }
                } else if (_this.selectedItem) {
                    _this.selectedItem.x += delta[0];
                    _this.selectedItem.y += delta[1];
                    _this.selectedItem.render();
                }

                renderConnections(_this.connections);

                _this.prevPosition = [e.clientX, e.clientY];

            }
            else if (_this.newConnection) {

                let position = correctedPosition(e.clientX, e.clientY, $('.pipeline-view'));

                _this.newConnection.xEnd = position.x;
                _this.newConnection.yEnd = position.y;

                _this.newConnection.render();

            }
        });


        // add all existing connections (this happens only at initialization - thus can be
        for (let key in this.state.steps) {
            if (this.state.steps.hasOwnProperty(key)) {
                let step = this.state.steps[key];

                for (let x = 0; x < step.incoming_connections.length; x++) {
                    let startNodeUUID = step.incoming_connections[x];
                    let endNodeUUID = step.uuid;

                    let startNodeOutgoingEl = $(this.refs.pipelineStepsHolder)
                        .find(".pipeline-step[data-uuid='" + startNodeUUID + "'] .outgoing-connections");

                    let endNodeIncomingEl = $(this.refs.pipelineStepsHolder)
                        .find(".pipeline-step[data-uuid='" + endNodeUUID + "'] .incoming-connections");

                    if (startNodeOutgoingEl.length > 0 && endNodeIncomingEl.length > 0) {
                        this.createConnection(startNodeOutgoingEl, endNodeIncomingEl);
                    }
                }
            }
        }

        this.pipelineListenersInitialized = true;
    }

    updateSelectionButtons() {
        if (this.state.selectedSteps.length > 0 && !this.state.stepSelector.active) {
            this.setState({
                showSelectionButton: true
            });
        }else{
            this.setState({
                showSelectionButton: false
            });
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {

        // add listeners once state is initialized by decodeJSON
        if (this.state.steps !== undefined) {

            // initialize pipeline after setting state in decodeJSON/setting up React components
            this.updatePipelineViewerState()

            // initliaze pipeline only once
            if (!this.pipelineListenersInitialized) {
                this.initializePipeline();
            }
        }

    }

    updateJupyterInstance() {
        let baseAddress = "http://"+ window.location.host + "/jupyter_" + this.state.backend.server_ip.replace(/\./g, "_") + "/";
        let token = this.state.backend.server_info.token;
        orchest.jupyter.updateJupyterInstance(baseAddress, token);
    }

    launchPipeline() {

        if (this.state.backend.working) {
            alert("Please wait, the pipeline is still busy.");
            return
        }

        if (!this.state.backend.running) {

            // send launch request to API

            // perform POST to save

            // get pipeline dir from webserver
            fetch("/async/pipelines/get_directory/" + this.props.pipeline.uuid, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow', // manual, *follow, error
                referrer: 'no-referrer', // no-referrer, *client
                headers: {
                    'Content-Type': 'application/json'
                },
            }).then(handleErrors).then((response) => {
                response.json().then((json) => {
                    let userdir_pipeline = json.result;

                    let data = {
                        "pipeline_uuid": this.props.pipeline.uuid,
                        "pipeline_dir": userdir_pipeline
                    };

                    this.state.backend.working = true;

                    this.setState({ "backend": this.state.backend });

                    fetch("/api-proxy/api/launches/", {
                        method: 'POST',
                        mode: 'cors',
                        cache: 'no-cache',
                        credentials: 'same-origin',
                        redirect: 'follow', // manual, *follow, error
                        referrer: 'no-referrer', // no-referrer, *client
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data)
                    }).then(handleErrors).then((response) => {
                        response.json().then((json) => {
                            console.log("API launch result");
                            console.log(json);

                            this.state.backend.running = true;
                            this.state.backend.working = false;

                            this.state.backend.server_ip = json.server_ip;
                            this.state.backend.server_info = json.server_info;

                            this.setState({ "backend": this.state.backend });

                            this.updateJupyterInstance();
                        })
                    });

                })
            })



        } else {

            this.state.backend.working = true;
            this.setState({
                "backend": this.state.backend
            })

            fetch("/api-proxy/api/launches/" + this.props.pipeline.uuid, {
                method: 'DELETE',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow', // manual, *follow, error
                referrer: 'no-referrer', // no-referrer, *client
            }).then(handleErrors).then((response) => {
                response.json().then((result) => {
                    console.log("API delete result");
                    console.log(result);

                    this.state.backend.running = false;
                    this.state.backend.working = false;
                    this.setState({ "backend": this.state.backend });
                })
            });

        }

    }

    newStep() {

        this.deselectSteps();

        let pipelineStepsHolderJEl = $(this.refs.pipelineStepsHolder);

        let step = {
            "title": "",
            "uuid": uuidv4(),
            "incoming_connections": [],
            "file_path": ".ipynb",
            "kernel": {
                "name": "docker_python",
                "display_name": "Python 3"
            },
            "image": "scipy-notebook-augmented",
            // TODO: incorporate pipeline step level resource control
            // "memory": "1024",
            // "vcpus": "1",
            // "gpus": "0",
            "experiment_json": "",
            "meta_data": {
                "position": [Math.min(pipelineStepsHolderJEl.width() / 2 / 2, 450), pipelineStepsHolderJEl.height() / 2]
            }
        };

        this.state.steps[step.uuid] = step;
        this.setState({ "steps": this.state.steps });

        this.selectStep(step.uuid);

    }

    selectStep(pipelineStepUUID) {
        if (this.state.openedStep) {
            this.setState({ "openedStep": undefined });
        }

        this.state.openedStep = pipelineStepUUID;

        this.setState({
            openedStep: pipelineStepUUID,
            selectedSteps: [pipelineStepUUID]
        });

        this.onSelectionChanged();
    }

    moveStep(pipelineStepUUID, x, y) {
        if(this.state.steps[pipelineStepUUID].meta_data.position[0] != x
            || this.state.steps[pipelineStepUUID].meta_data.position[1] != y){
                this.state.steps[pipelineStepUUID].meta_data.position = [x, y];
                this.state.unsavedChanges = true;
        }
    }

    stepNameUpdate(pipelineStepUUID, title, file_path) {
        this.state.steps[pipelineStepUUID].title = title;
        this.state.steps[pipelineStepUUID].file_path = file_path;
        this.setState({ "steps": this.state.steps });
    }

    makeConnection(sourcePipelineStepUUID, targetPipelineStepUUID) {
        if (this.state.steps[targetPipelineStepUUID].incoming_connections.indexOf(sourcePipelineStepUUID) === -1) {
            this.state.steps[targetPipelineStepUUID].incoming_connections.push(sourcePipelineStepUUID);
        }

        this.forceUpdate();
    }

    getStepExecutionState(stepUUID) {
        if (this.state.stepExecutionState[stepUUID]) {
            return this.state.stepExecutionState[stepUUID];
        } else {
            return { status: "idle", time: new Date() };
        }
    }
    setStepExecutionState(stepUUID, executionState) {

        this.state.stepExecutionState[stepUUID] = executionState;

        this.setState({
            "stepExecutionState": this.state.stepExecutionState
        })
    }

    removeConnection(sourcePipelineStepUUID, targetPipelineStepUUID) {
        let connectionIndex = this.state.steps[targetPipelineStepUUID].incoming_connections.indexOf(sourcePipelineStepUUID);
        if (connectionIndex !== -1) {
            this.state.steps[targetPipelineStepUUID].incoming_connections.splice(connectionIndex, 1);
        }

        this.forceUpdate();
    }

    onDetailsDelete() {
        let uuid = this.state.openedStep;

        // also delete incoming connections that contain this uuid
        for (let key in this.state.steps) {
            if (this.state.steps.hasOwnProperty(key)) {
                let step = this.state.steps[key];

                let connectionIndex = step.incoming_connections.indexOf(uuid);
                if (connectionIndex !== -1) {
                    step.incoming_connections.splice(connectionIndex, 1);

                    // also delete incoming connections from GUI
                    let connection = this.getConnectionByUUIDs(uuid, step.uuid);
                    this.connections.splice(this.connections.indexOf(connection), 1);
                    connection.remove();
                }

            }
        }

        // visually delete incoming connections from GUI
        let step = this.state.steps[uuid];
        for (let x = 0; x < step.incoming_connections.length; x++) {

            let connection = this.getConnectionByUUIDs(step.incoming_connections[x], uuid);
            this.connections.splice(this.connections.indexOf(connection), 1);
            connection.remove();
        }

        delete this.state.steps[uuid];
        this.setState({ "steps": this.state.steps, "openedStep": undefined });
    }

    onOpenNotebook(pipelineDetailsComponent) {
        if (this.state.backend.running) {
            orchest.jupyter.navigateTo(this.state.steps[this.state.openedStep].file_path);
            orchest.showJupyter();
            orchest.headerBarComponent.showBack();
        } else {
            alert("Please start the back-end before opening the Notebook in Jupyter");
        }
    }

    parseRunStatuses(result) {

        if (result.step_statuses === undefined || result.step_statuses.length === undefined) {
            console.error("Did not contain step_statuses list. Invalid `result` object");
        }

        for (let x = 0; x < result.step_statuses.length; x++) {

            // ended_time takes priority over started_time
            let started_time = undefined;
            let ended_time = undefined;

            if (result.step_statuses[x].started_time) {
                started_time = new Date(result.step_statuses[x].started_time + " GMT")
            }
            if (result.step_statuses[x].ended_time) {
                ended_time = new Date(result.step_statuses[x].ended_time + " GMT")
            }

            this.setStepExecutionState(result.step_statuses[x].step_uuid, { status: result.step_statuses[x].status, started_time: started_time, ended_time: ended_time })
        }

    }

    pollPipelineStepStatuses() {

        if (this.state.runUuid) {

            fetch("/api-proxy/api/runs/" + this.state.runUuid, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow', // manual, *follow, error
                referrer: 'no-referrer', // no-referrer, *client
            }).then(handleErrors).then((response) => {
                response.json().then((result) => {

                    this.parseRunStatuses(result);

                    if (result.status === "SUCCESS") {
                        this.setState({
                            pipelineRunning: false
                        });
                        clearInterval(this.pipelineStepStatusPollingInterval);
                    }
                })
            });


        }

    }

    centerView(){

        this.pipelineOffset[0] = 0;
        this.pipelineOffset[1] = 0;

        this.renderBackground();

        this.forceUpdate();
    }

    runSelectedSteps() {
        this.runStepUuids(this.state.selectedSteps, "selection");
    }

    runStepUuids(uuids, type) {

        if (this.state.pipelineRunning) {
            alert("The pipeline is currently executing, please wait until it completes.");
            return;
        }

        this.setState({
            pipelineRunning: true
        });

        // store pipeline.json
        let data = {
            "uuids": uuids,
            "run_type": type,
            "pipeline_description": this.getPipelineJSON()
        };

        fetch("/catch/api-proxy/api/runs/", {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'no-cache',
            credentials: 'same-origin',
            redirect: 'follow', // manual, *follow, error
            referrer: 'no-referrer', // no-referrer, *client
            body: JSON.stringify(data)
        }).then(handleErrors).then((response) => {
            response.json().then((result) => {

                this.parseRunStatuses(result);

                this.setState({
                    runUuid: result.run_uuid
                });

                // initialize interval
                this.pipelineStepStatusPollingInterval = setInterval(this.pollPipelineStepStatuses.bind(this), this.STATUS_POLL_FREQUENCY);

            })
        });
    }

    onRunIncoming() {
        this.runStepUuids(this.state.selectedSteps, "incoming");
    }

    onCloseDetails(pipelineDetailsComponent) {
        this.setState({
            "openedStep": undefined,
        });
    }

    onDetailsChangeView(newIndex){

        this.setState({
            defaultDetailViewIndex: newIndex
        });

    }

    onSaveDetails(pipelineDetailsComponent) {

        // update step state based on latest state of pipelineDetails component

        // step name
        this.state.steps[pipelineDetailsComponent.props.step.uuid] = JSON.parse(JSON.stringify(pipelineDetailsComponent.state.step));

        // update steps in setState even though reference objects are directly modified - this propagates state updates properly
        this.setState({ 
            "steps": this.state.steps,    
            "unsavedChanges": true
        });
    }

    getPowerButtonClasses() {
        let classes = [];

        if (this.state.backend.running) {
            classes.push("active");
        }
        if (this.state.backend.working) {
            classes.push("working");
        }

        return classes;
    }

    deselectSteps() {

        this.state.stepSelector.x1 = Number.MIN_VALUE;
        this.state.stepSelector.y1 = Number.MIN_VALUE;
        this.state.stepSelector.x2 = Number.MIN_VALUE;
        this.state.stepSelector.y2 = Number.MIN_VALUE;
        this.state.stepSelector.active = false;

        this.setState({
            stepSelector: this.state.stepSelector,
            selectedSteps: this.getSelectedSteps()
        });

        this.onSelectionChanged();
    }

    deselectConnection() {
        this.selectedConnection.deselectState();
        this.selectedConnection = undefined;
    }

    getSelectedSteps() {
        let rect = this.getStepSelectorRectangle();

        let selectedSteps = [];

        // for each step perform intersect
        if (this.state.stepSelector.active) {
            for (let uuid in this.state.steps) {
                if (this.state.steps.hasOwnProperty(uuid)) {
                    let step = this.state.steps[uuid];

                    // guard against ref existing, in case step is being added
                    if (this.refs[uuid]) {
                        let stepDom = $(this.refs[uuid].refs.container);

                        let stepRect = {
                            x: step.meta_data.position[0],
                            y: step.meta_data.position[1],
                            width: stepDom.outerWidth(),
                            height: stepDom.outerHeight()
                        }

                        if (intersectRect(rect, stepRect)) {
                            selectedSteps.push(uuid);
                        }
                    }
                }
            }
        }

        return selectedSteps;
    }

    onSelectionChanged(){
        this.updateSelectionButtons();
    }

    onPipelineStepsOuterHolderMove(e) {

        if (this.state.stepSelector.active) {

            let pipelineStepHolderOffset = $(this.refs.pipelineStepsHolder).offset();

            this.state.stepSelector.x2 = e.clientX - pipelineStepHolderOffset.left;
            this.state.stepSelector.y2 = e.clientY - pipelineStepHolderOffset.top;

            this.setState({
                stepSelector: this.state.stepSelector,
                selectedSteps: this.getSelectedSteps()
            })

            this.onSelectionChanged();
        }

        if (this.draggingPipeline) {

            let dx = e.nativeEvent.movementX;
            let dy = e.nativeEvent.movementY;

            this.pipelineOffset[0] -= dx / 2;
            this.pipelineOffset[1] -= dy / 2;

            this.renderBackground();
        }

    }

    renderBackground(){
        $(this.refs.pipelineStepsHolder).css({ transform: "translateX(" + -this.pipelineOffset[0] + "px) translateY(" + -this.pipelineOffset[1] + "px)" });

        $(this.refs.pipelineStepsOuterHolder).css({ backgroundPosition: -this.pipelineOffset[0] + "px " + -this.pipelineOffset[1] + "px" });
    }

    onPipelineStepsOuterHolderDown(e) {

        if (($(e.target).hasClass('pipeline-steps-holder') || $(e.target).hasClass('pipeline-steps-outer-holder')) && e.button === 0) {

            if (this.keysDown[32]) {

                // space held while clicking, means canvas drag
                $(this.refs.pipelineStepsOuterHolder).addClass("dragging");
                this.draggingPipeline = true;

            } else {
                let pipelineStepHolderOffset = $('.pipeline-steps-holder').offset();

                this.state.stepSelector.active = true;
                this.state.stepSelector.x1 = e.clientX - pipelineStepHolderOffset.left;
                this.state.stepSelector.y1 = e.clientY - pipelineStepHolderOffset.top;
                this.state.stepSelector.x2 = e.clientX - pipelineStepHolderOffset.left;
                this.state.stepSelector.y2 = e.clientY - pipelineStepHolderOffset.top;

                this.setState({
                    stepSelector: this.state.stepSelector
                })
            }

        }
    }

    getStepSelectorRectangle() {
        let rect = {
            x: Math.min(this.state.stepSelector.x1, this.state.stepSelector.x2),
            y: Math.min(this.state.stepSelector.y1, this.state.stepSelector.y2),
            width: Math.abs(this.state.stepSelector.x2 - this.state.stepSelector.x1),
            height: Math.abs(this.state.stepSelector.y2 - this.state.stepSelector.y1)
        }
        return rect;
    }

    centerButtonDisabled(){
        return this.pipelineOffset[0] == 0 && this.pipelineOffset[1] == 0;
    }

    render() {

        let pipelineSteps = [];

        for (let uuid in this.state.steps) {
            if (this.state.steps.hasOwnProperty(uuid)) {
                let step = this.state.steps[uuid];

                let selected = this.state.selectedSteps.indexOf(uuid) !== -1;

                pipelineSteps.push(<PipelineStep
                    key={step.uuid}
                    step={step}
                    selected={selected}
                    ref={step.uuid}
                    executionState={this.getStepExecutionState(step.uuid)}
                    onConnect={this.makeConnection.bind(this)}
                    onMove={this.moveStep.bind(this)}
                    onClick={this.selectStep.bind(this)} />);
            }
        }

        let pipelineName = "";
        if (this.state.pipelineJson) {
            pipelineName = this.state.pipelineJson.name;
        }


        let connections_list = [];
        if (this.state.openedStep) {

            let incoming_connections = this.state.steps[this.state.openedStep].incoming_connections;

            for (var x = 0; x < incoming_connections.length; x++) {
                connections_list[incoming_connections[x]] = [this.state.steps[incoming_connections[x]].title, this.state.steps[incoming_connections[x]].file_path]
            }
        }

        let stepSelectorComponent = undefined;

        if (this.state.stepSelector.active) {

            let rect = this.getStepSelectorRectangle();

            stepSelectorComponent = <div className="step-selector" style={{
                width: rect.width,
                height: rect.height,
                left: rect.x,
                top: rect.y
            }}>
            </div>;
        }

        return <div className={"pipeline-view"}>
            <div className={"pane"}>
                <div className={"pipeline-actions bottom-left"}>
                    <MDCButtonReact disabled={this.centerButtonDisabled()} onClick={this.centerView.bind(this)} icon="crop_free" />
                    {(() => {
                        if (this.state.showSelectionButton) {
                            return <div className="selection-buttons">
                                <MDCButtonReact onClick={this.runSelectedSteps.bind(this)} label="Run selected steps" />
                                <MDCButtonReact onClick={this.onRunIncoming.bind(this)} label="Run incoming steps" />
                            </div>;
                        }
                    })()}
                </div>
                <div className={"pipeline-actions"}>

                    <MDCButtonReact
                        onClick={this.launchPipeline.bind(this)}
                        classNames={this.getPowerButtonClasses()}
                        icon={ this.state.backend.working ? "hourglass_empty" : "power_settings_new" }
                    />

                    <MDCButtonReact
                        onClick={this.newStep.bind(this)}
                        icon={"add"}
                        label={"NEW STEP"}
                    />

                    <MDCButtonReact
                        ref="saveButton"
                        onClick={this.savePipeline.bind(this)}
                        label={this.state.unsavedChanges ? "SAVE*" : "SAVE"}
                    />

                    <MDCButtonReact
                        onClick={this.openSettings.bind(this)}
                        label={"Settings"}
                        icon="tune"
                    />

                </div>
                <div className="pipeline-steps-outer-holder" ref={"pipelineStepsOuterHolder"} onMouseMove={this.onPipelineStepsOuterHolderMove.bind(this)}
                    onMouseDown={this.onPipelineStepsOuterHolderDown.bind(this)}
                >
                    <div className={"pipeline-steps-holder"}

                        ref={"pipelineStepsHolder"}
                    >

                        {stepSelectorComponent}

                        {pipelineSteps}


                    </div>


                </div>
            </div>

            {(() => {
                if (this.state.openedStep) {
                    return <PipelineDetails
                        onSave={this.onSaveDetails.bind(this)}
                        onNameUpdate={this.stepNameUpdate.bind(this)}
                        onDelete={this.onDetailsDelete.bind(this)}
                        onClose={this.onCloseDetails.bind(this)}
                        onOpenNotebook={this.onOpenNotebook.bind(this)}
                        connections={connections_list}
                        defaultViewIndex={this.state.defaultDetailViewIndex}
                        onChangeView={this.onDetailsChangeView.bind(this)}
                        pipeline={this.props.pipeline}
                        step={JSON.parse(JSON.stringify(this.state.steps[this.state.openedStep]))} />
                }
            })()}
        </div>;
    }
}

export default PipelineView;
