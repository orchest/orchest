// @ts-nocheck
import * as React from "react";
import io from "socket.io-client";
import _ from "lodash";

import {
  uuidv4,
  intersectRect,
  globalMDCVars,
  collapseDoubleDots,
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
  activeElementIsInput,
} from "@orchest/lib-utils";
import { MDCButtonReact } from "@orchest/lib-mdc";
import { OrchestContext, OrchestSessionsConsumer } from "@/hooks/orchest";
import {
  checkGate,
  getScrollLineHeight,
  getPipelineJSONEndpoint,
  serverTimeToDate,
  getServiceURLs,
  filterServices,
  validatePipeline,
} from "@/utils/webserver-utils";

import { Layout } from "@/components/Layout";
import PipelineDetails from "@/components/PipelineDetails";
import PipelineStep from "@/components/PipelineStep";
import PipelineSettingsView from "@/views/PipelineSettingsView";
import LogsView from "@/views/LogsView";
import FilePreviewView from "@/views/FilePreviewView";
import JobView from "@/views/JobView";
import JupyterLabView from "@/views/JupyterLabView";
import PipelinesView from "@/views/PipelinesView";
import ProjectsView from "@/views/ProjectsView";

function ConnectionDOMWrapper(el, startNode, endNode, pipelineView) {
  this.startNode = startNode;
  this.endNode = endNode;

  this.x = 0;
  this.y = 0;

  this.pipelineView = pipelineView;
  this.pipelineViewEl = $(pipelineView.refManager.refs.pipelineStepsHolder);

  this.nodeCenter = function (el, parentEl) {
    let nodePosition = this.localElementPosition(el, parentEl);
    nodePosition.x += el.width() / 2;
    nodePosition.y += el.height() / 2;
    return nodePosition;
  };

  this.localElementPosition = function (el, parentEl) {
    let position = {};
    position.x = this.pipelineView.scaleCorrectedPosition(
      el.offset().left - parentEl.offset().left
    );
    position.y = this.pipelineView.scaleCorrectedPosition(
      el.offset().top - parentEl.offset().top
    );
    return position;
  };

  // initialize xEnd and yEnd at startNode position
  let startNodePosition = this.nodeCenter(this.startNode, this.pipelineViewEl);

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
      this.startNodeUUID = this.startNode
        .parents(".pipeline-step")
        .attr("data-uuid");
      this.el.attr("data-start-uuid", this.startNodeUUID);
    }
  };

  this.setEndNode = function (endNodeJEl) {
    this.endNode = endNodeJEl;
    if (endNodeJEl) {
      this.endNodeUUID = this.endNode
        .parents(".pipeline-step")
        .attr("data-uuid");
      this.el.attr("data-end-uuid", this.endNodeUUID);
    }
  };

  this.selectState = function () {
    $(this.svgPath).attr("stroke", globalMDCVars()["mdcthemesecondary"]);
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

  this.svgPathClickable = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  this.svgPathClickable.setAttribute("stroke", "transparent");
  this.svgPathClickable.setAttribute("stroke-width", "16");
  this.svgPathClickable.setAttribute("fill", "none");
  this.svgPathClickable.setAttribute("id", "path-clickable");
  this.svgEl.appendChild(this.svgPath);
  this.svgEl.appendChild(this.svgPathClickable);

  this.el.append(this.svgEl);

  this.render = function () {
    let startNodePosition = this.nodeCenter(
      this.startNode,
      this.pipelineViewEl
    );
    this.x = startNodePosition.x;
    this.y = startNodePosition.y;
    this.lineHeight = 2;

    // set xEnd and yEnd if endNode is defined

    if (this.endNode) {
      let endNodePosition = this.nodeCenter(this.endNode, this.pipelineViewEl);
      this.xEnd = endNodePosition.x;
      this.yEnd = endNodePosition.y;
    }

    let targetX = this.xEnd - this.x;
    let targetY = this.yEnd - this.y;

    let xOffset = 0;
    let yOffset = 0;

    if (targetX < 0) {
      xOffset = targetX;
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

    this.el.css(
      "transform",
      "translateX(" +
        (this.x - this.svgPadding + xOffset) +
        "px) translateY(" +
        (this.y - this.svgPadding + yOffset - this.lineHeight / 2) +
        "px)"
    );

    // update svg poly line
    this.svgEl.setAttribute(
      "width",
      Math.abs(targetX) + 2 * this.svgPadding + "px"
    );
    this.svgEl.setAttribute(
      "height",
      Math.abs(targetY) + 2 * this.svgPadding + "px"
    );

    this.svgPath.setAttribute(
      "d",
      this.curvedHorizontal(
        this.svgPadding - xOffset,
        this.svgPadding - yOffset,
        this.svgPadding + targetX - xOffset - this.arrowWidth,
        this.svgPadding + targetY - yOffset
      )
    );
    this.svgPathClickable.setAttribute("d", this.svgPath.getAttribute("d"));
  };

  this.curvedHorizontal = function (x1, y1, x2, y2) {
    let line = [];
    let mx = x1 + (x2 - x1) / 2;

    line.push("M", x1, y1);
    line.push("C", mx, y1, mx, y2, x2, y2);

    return line.join(" ");
  };
}

class PipelineView extends React.Component {
  static contextType = OrchestContext;

  componentWillUnmount() {
    this.context.dispatch({
      type: "clearView",
    });

    this.disconnectSocketIO();

    $(document).off("mouseup.initializePipeline");
    $(document).off("mousedown.initializePipeline");
    $(document).off("keyup.initializePipeline");
    $(document).off("keydown.initializePipeline");

    clearInterval(this.pipelineStepStatusPollingInterval);
    clearInterval(this.sessionPollingInterval);

    this.promiseManager.cancelCancelablePromises();
    this._ismounted = false;
  }

  constructor(props, context) {
    super(props, context);

    // class constants
    this.STATUS_POLL_FREQUENCY = 1000;
    this.DRAG_CLICK_SENSITIVITY = 3;
    this.CANVAS_VIEW_MULTIPLE = 3;

    this.INITIAL_PIPELINE_POSITION = [-1, -1];
    this.initializedPipeline = false;

    this.selectedItem = undefined;
    this.selectedConnection = undefined;

    // newConnection is for creating a new connection
    this.newConnection = undefined;

    this.keysDown = {};
    this.draggingPipeline = false;
    this.pipelineOffset = [
      this.INITIAL_PIPELINE_POSITION[0],
      this.INITIAL_PIPELINE_POSITION[1],
    ];
    this.pipelineOrigin = [0, 0];
    this.mouseClientX = 0;
    this.mouseClientY = 0;

    // double click timer
    this.doubleClickFirstClick = false;
    this.DOUBLE_CLICK_TIMEOUT = 300;

    this.scaleFactor = 1;

    this.connections = [];
    this.pipelineSteps = {};
    this.pipelineRefs = [];
    this.prevPosition = [];

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
    this._ismounted = true;

    this.currentOngoingSaves = 0;
    this.pipelineStepStatusPollingInterval = undefined;
    this.sessionPollingInterval = undefined;

    this.state = {
      openedStep: undefined,
      openedMultistep: undefined,
      showServices: false,
      selectedSteps: [],
      runStatusEndpoint: "/catch/api-proxy/api/runs/",
      stepSelector: {
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
      pipelineRunning: false,
      waitingOnCancel: false,
      runUUID: undefined,
      stepExecutionState: {},
      steps: {},
      defaultDetailViewIndex: 0,
      shouldAutoStart: false,
      // The save hash is used to propagate a save's side-effects
      // to components.
      saveHash: "",
      isDeletingStep: false,
    };

    if (this.props.queryArgs.run_uuid && this.props.queryArgs.job_uuid) {
      try {
        this.state.runUUID = this.props.queryArgs.run_uuid;
        this.state.runStatusEndpoint =
          "/catch/api-proxy/api/jobs/" + this.props.queryArgs.job_uuid + "/";
        this.pollPipelineStepStatuses();
        this.startStatusInterval();
      } catch (e) {
        console.log("could not start pipeline status updates: " + e);
      }
    } else {
      if (this.props.queryArgs.read_only === "true") {
        // for non pipelineRun - read only check gate
        let checkGatePromise = checkGate(this.props.queryArgs.project_uuid);
        checkGatePromise
          .then(() => {
            this.loadViewInEdit();
          })
          .catch((result) => {
            if (result.reason === "gate-failed") {
              orchest.requestBuild(
                props.queryArgs.project_uuid,
                result.data,
                "Pipeline",
                () => {
                  this.loadViewInEdit();
                }
              );
            }
          });
      }

      // retrieve interactive run runUUID to show pipeline exeuction state
      this.fetchActivePipelineRuns();
    }
  }

  loadViewInEdit() {
    let newProps = {};
    Object.assign(newProps, this.props);
    newProps.queryArgs.read_only = "false";
    newProps.key = uuidv4();
    // open in non-read only
    orchest.loadView(PipelineView, newProps);
  }

  fetchActivePipelineRuns() {
    let pipelineRunsPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/runs/?project_uuid=${this.props.queryArgs.project_uuid}&pipeline_uuid=${this.props.queryArgs.pipeline_uuid}`
      ),
      this.promiseManager
    );

    pipelineRunsPromise.promise
      .then((response) => {
        let data = JSON.parse(response);

        try {
          // Note that runs are returned by the orchest-api by
          // started_time DESC. So we can just retrieve the first run.
          if (data["runs"].length > 0) {
            let run = data["runs"][0];
            this.state.runUUID = run.uuid;
            this.pollPipelineStepStatuses();
            this.startStatusInterval();
          }
        } catch (e) {
          console.log("Error parsing return from orchest-api " + e);
        }
      })
      .catch((error) => {
        if (!error.isCanceled) {
          console.error(erorr);
        }
      });
  }

  savePipeline(callback) {
    if (this.props.queryArgs.read_only !== "true") {
      let pipelineJSON = this.encodeJSON();

      // validate pipelineJSON
      let pipelineValidation = validatePipeline(pipelineJSON);

      // if invalid
      if (pipelineValidation.valid !== true) {
        // Just show the first error
        orchest.alert("Error", pipelineValidation.errors[0]);
      } else {
        // store pipeline.json
        let formData = new FormData();
        formData.append("pipeline_json", JSON.stringify(pipelineJSON));

        this.setState({
          saveHash: uuidv4(),
        });

        clearTimeout(this.saveIndicatorTimeout);
        this.currentOngoingSaves++;
        this.saveIndicatorTimeout = setTimeout(() => {
          this.context.dispatch({
            type: "pipelineSetSaveStatus",
            payload: "saving",
          });
        }, 100);

        // perform POST to save
        makeRequest(
          "POST",
          `/async/pipelines/json/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`,
          { type: "FormData", content: formData }
        )
          .then(() => {
            if (callback && typeof callback == "function" && this._ismounted) {
              callback();
            }
          })
          .finally(() => {
            this.currentOngoingSaves--;
            if (this.currentOngoingSaves === 0) {
              clearTimeout(this.saveIndicatorTimeout);
              this.context.dispatch({
                type: "pipelineSetSaveStatus",
                payload: "saved",
              });
            }
          });
      }
    } else {
      console.error("savePipeline should be uncallable in readOnly mode.");
    }
  }

  encodeJSON() {
    // generate JSON representation using the internal state of React components
    // describing the pipeline

    let pipelineJSON = _.cloneDeep(this.state.pipelineJson);
    pipelineJSON["steps"] = {};

    for (let key in this.state.steps) {
      if (this.state.steps.hasOwnProperty(key)) {
        // deep copy step
        let step = _.cloneDeep(this.state.steps[key]);

        // remove private meta_data (prefixed with underscore)
        let keys = Object.keys(step.meta_data);
        for (let x = 0; x < keys.length; x++) {
          let key = keys[x];
          if (key[0] === "_") {
            delete step.meta_data[key];
          }
        }

        // we do not encode outgoing connections explicitly according to
        // pipeline.json spec.
        if (step["outgoing_connections"]) {
          delete step["outgoing_connections"];
        }

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

        // augmenting state with runtime data in meta_data
        steps[key].meta_data._drag_count = 0;
        steps[key].meta_data._dragged = false;
      }
    }

    // in addition to creating steps explicitly in the React state, also attach full pipelineJson
    this.setState({ steps: steps, pipelineJson: pipelineJson });
  }

  getPipelineJSON() {
    this.state.pipelineJson.steps = this.state.steps;
    return this.state.pipelineJson;
  }

  renderConnections(connections) {
    for (let x = 0; x < connections.length; x++) {
      connections[x].render();
    }
  }

  openSettings(initial_tab) {
    let queryArgs = {
      project_uuid: this.props.queryArgs.project_uuid,
      pipeline_uuid: this.props.queryArgs.pipeline_uuid,
      read_only: this.props.queryArgs.read_only,
      job_uuid: this.props.queryArgs.job_uuid,
      run_uuid: this.props.queryArgs.run_uuid,
    };

    if (initial_tab) {
      queryArgs.initial_tab = initial_tab;
    }

    orchest.loadView(PipelineSettingsView, {
      queryArgs,
    });
  }

  openLogs() {
    orchest.loadView(LogsView, {
      queryArgs: {
        project_uuid: this.props.queryArgs.project_uuid,
        pipeline_uuid: this.props.queryArgs.pipeline_uuid,
        read_only: this.props.queryArgs.read_only,
        job_uuid: this.props.queryArgs.job_uuid,
        run_uuid: this.props.queryArgs.run_uuid,
      },
    });
  }

  showServices() {
    this.setState({
      showServices: true,
    });
  }

  hideServices() {
    this.setState({
      showServices: false,
    });
  }

  areQueryArgsValid() {
    // Verify required props
    if (
      this.props.queryArgs.pipeline_uuid === undefined ||
      this.props.queryArgs.project_uuid === undefined
    ) {
      return false;
    } else {
      return true;
    }
  }

  loadDefaultPipeline() {
    // Fetch this project's pipeline
    orchest.getProject().then((selectedProject) => {
      if (selectedProject !== undefined) {
        // initialize REST call for pipelines
        let fetchPipelinesPromise = makeCancelable(
          makeRequest("GET", `/async/pipelines/${selectedProject}`),
          this.promiseManager
        );

        fetchPipelinesPromise.promise
          .then((response) => {
            let data = JSON.parse(response);

            if (data.result.length > 0) {
              orchest.loadView(PipelineView, {
                queryArgs: {
                  pipeline_uuid: data.result[0].uuid,
                  project_uuid: selectedProject,
                },
                key: uuidv4(),
              });
            } else {
              orchest.loadView(PipelinesView);
            }
          })
          .catch((e) => {
            console.error(e);
            orchest.loadView(ProjectsView);
          });
      } else {
        orchest.loadView(PipelinesView);
      }
    });
  }

  componentDidMount() {
    this.context.dispatch({
      type: "setView",
      payload: "pipeline",
    });
    if (this.areQueryArgsValid()) {
      this.setState({ shouldAutoStart: true });
      this.handleSession();
      this.fetchPipelineAndInitialize();
      this.connectSocketIO();
      this.initializeResizeHandlers();
    } else {
      this.loadDefaultPipeline();
    }
  }

  handleSession() {
    if (!this.context.state.sessionsIsLoading) {
      const session = this.context.get.session(this.props.queryArgs);

      // If session doesn't exist and first load
      if (
        this.props.queryArgs.read_only !== "true" &&
        this.state.shouldAutoStart === true &&
        typeof session === "undefined"
      ) {
        this.context.dispatch({
          type: "sessionToggle",
          payload: this.props.queryArgs,
        });
        this.setState({ shouldAutoStart: false });
        return;
      }

      if (session?.status == "RUNNING" && this.state.shouldAutoStart === true) {
        this.setState({ shouldAutoStart: false });
      }

      if (session?.status === "STOPPING") {
        orchest.jupyter.unload();
      }

      if (session?.notebook_server_info) {
        this.updateJupyterInstance();
      }
    }
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // fetch pipeline when uuid changed
    if (
      this.props.queryArgs.pipeline_uuid !== prevProps.queryArgs.pipeline_uuid
    ) {
      this.fetchPipelineAndInitialize();
      this.pipelineSetHolderSize();
    }

    this.handleSession();
  }

  initializeResizeHandlers() {
    $(window).resize(() => {
      this.pipelineSetHolderSize();
    });
  }

  // TODO: only make this.sio defined after successful
  // connect to avoid .emit()'ing to unconnected
  // sio client (emits aren't buffered).
  connectSocketIO() {
    // disable polling
    this.sio = io.connect("/pty", { transports: ["websocket"] });
  }

  disconnectSocketIO() {
    if (this.sio) {
      this.sio.disconnect();
    }
  }

  getConnectionByUUIDs(startNodeUUID, endNodeUUID) {
    for (let x = 0; x < this.connections.length; x++) {
      if (
        this.connections[x].startNodeUUID === startNodeUUID &&
        this.connections[x].endNodeUUID === endNodeUUID
      ) {
        return this.connections[x];
      }
    }
  }

  createConnection(outgoingJEl, incomingJEl) {
    // create a new element that represents the connection (svg image)
    let connectionHolder = document.createElement("div");
    $(connectionHolder).addClass("connection");

    let newConnection = new ConnectionDOMWrapper(
      connectionHolder,
      outgoingJEl,
      incomingJEl,
      this
    );
    this.connections.push(newConnection);

    if (!incomingJEl) {
      this.newConnection = newConnection;
    }

    newConnection.render();

    $(this.refManager.refs.pipelineStepsHolder).append(connectionHolder);
  }

  willCreateCycle(startNodeUUID, endNodeUUID) {
    // add connection temporarily
    let insertIndex =
      this.state.steps[endNodeUUID].incoming_connections.push(startNodeUUID) -
      1;

    // augment incoming_connections with outgoing_connections to be able to traverse from root nodes

    // reset outgoing_connections state (creates 2N algorithm, but makes for guaranteerd clean state.steps data structure)
    for (let step_uuid in this.state.steps) {
      if (this.state.steps.hasOwnProperty(step_uuid)) {
        this.state.steps[step_uuid].outgoing_connections = [];
      }
    }

    for (let step_uuid in this.state.steps) {
      if (this.state.steps.hasOwnProperty(step_uuid)) {
        let incoming_connections = this.state.steps[step_uuid]
          .incoming_connections;
        for (let x = 0; x < incoming_connections.length; x++) {
          this.state.steps[incoming_connections[x]].outgoing_connections.push(
            step_uuid
          );
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

    for (
      let x = 0;
      x < this.state.steps[step_uuid].outgoing_connections.length;
      x++
    ) {
      let child_uuid = this.state.steps[step_uuid].outgoing_connections[x];

      if (whiteSet.has(child_uuid)) {
        if (this.dfsWithSets(child_uuid, whiteSet, greySet)) {
          return true;
        }
      } else if (greySet.has(child_uuid)) {
        return true;
      }
    }

    // move from grey to black
    greySet.delete(step_uuid);
  }

  initializePipelineEditListeners() {
    $(document).on("mouseup.initializePipeline", (e) => {
      if (this.newConnection) {
        let endNodeUUID = $(e.target)
          .parents(".pipeline-step")
          .attr("data-uuid");
        let startNodeUUID = this.newConnection.startNode
          .parents(".pipeline-step")
          .attr("data-uuid");

        // check whether drag release was on .incomming-connections class
        let dragEndedInIcomingConnectionsElement = $(e.target).hasClass(
          "incoming-connections"
        );
        let noConnectionExists = true;

        // check whether there already exists a connection
        if (dragEndedInIcomingConnectionsElement) {
          noConnectionExists =
            this.refManager.refs[
              endNodeUUID
            ].props.step.incoming_connections.indexOf(startNodeUUID) === -1;
        }

        // check whether connection will create a cycle in Pipeline graph
        let connectionCreatesCycle = false;
        if (noConnectionExists && dragEndedInIcomingConnectionsElement) {
          connectionCreatesCycle = this.willCreateCycle(
            startNodeUUID,
            endNodeUUID
          );
        }

        if (connectionCreatesCycle) {
          orchest.alert(
            "Error",
            "Connecting this step will create a cycle in your pipeline which is not supported."
          );
        }

        if (
          dragEndedInIcomingConnectionsElement &&
          noConnectionExists &&
          !connectionCreatesCycle
        ) {
          // newConnection
          this.newConnection.setEndNode($(e.target));
          this.refManager.refs[endNodeUUID].props.onConnect(
            startNodeUUID,
            endNodeUUID
          );
          this.newConnection.render();
        } else {
          this.newConnection.el.remove();
          this.connections.splice(
            this.connections.indexOf(this.newConnection),
            1
          );

          if (!noConnectionExists) {
            orchest.alert(
              "Error",
              "These steps are already connected. No new connection has been created."
            );
          }
        }

        // clean up hover effects
        $(".incoming-connections").removeClass("hover");
      }
      this.newConnection = undefined;

      // clean up creating-connection class
      $(".pipeline-step").removeClass("creating-connection");
    });

    $(this.refManager.refs.pipelineStepsHolder).on(
      "mousedown",
      ".pipeline-step .outgoing-connections",
      (e) => {
        if (e.button === 0) {
          $(e.target).parents(".pipeline-step").addClass("creating-connection");
          // create connection
          this.createConnection($(e.target));
        }
      }
    );

    $(document).on("keydown.initializePipeline", (e) => {
      if (
        !this.state.isDeletingStep &&
        !activeElementIsInput() &&
        (e.keyCode === 8 || e.keyCode === 46)
      ) {
        // Make sure that successively pressing backspace does not trigger
        // another delete.

        this.deleteSelectedSteps();
      }
    });

    $(document).on("keyup.initializePipeline", (e) => {
      if (!activeElementIsInput() && (e.keyCode === 8 || e.keyCode === 46)) {
        if (this.selectedConnection) {
          e.preventDefault();

          this.removeConnection(
            this.selectedConnection.startNodeUUID,
            this.selectedConnection.endNodeUUID
          );
          this.connections.splice(
            this.connections.indexOf(this.selectedConnection),
            1
          );
          this.selectedConnection.remove();
        }
      }
    });

    $(this.refManager.refs.pipelineStepsOuterHolder).on("mousemove", (e) => {
      if (this.selectedItem !== undefined) {
        let delta = [
          this.scaleCorrectedPosition(e.clientX) - this.prevPosition[0],
          this.scaleCorrectedPosition(e.clientY) - this.prevPosition[1],
        ];

        this.prevPosition = [
          this.scaleCorrectedPosition(e.clientX),
          this.scaleCorrectedPosition(e.clientY),
        ];

        let step = this.state.steps[this.selectedItem];

        step.meta_data._drag_count++;
        if (step.meta_data._drag_count >= this.DRAG_CLICK_SENSITIVITY) {
          step.meta_data._dragged = true;
          step.meta_data._drag_count = 0;
        }

        // check for spacebar
        if (!this.draggingPipeline) {
          if (
            this.state.selectedSteps.length > 1 &&
            this.state.selectedSteps.indexOf(this.selectedItem) !== -1
          ) {
            for (let key in this.state.selectedSteps) {
              let uuid = this.state.selectedSteps[key];

              let singleStep = this.state.steps[uuid];

              singleStep.meta_data.position[0] += delta[0];
              singleStep.meta_data.position[1] += delta[1];

              this.refManager.refs[uuid].updatePosition(
                singleStep.meta_data.position
              );
            }
          } else if (this.selectedItem !== undefined) {
            step.meta_data.position[0] += delta[0];
            step.meta_data.position[1] += delta[1];

            this.refManager.refs[step.uuid].updatePosition(
              step.meta_data.position
            );
          }
        }

        this.renderConnections(this.connections);
      } else if (this.newConnection) {
        let pipelineStepHolderOffset = $(
          this.refManager.refs.pipelineStepsHolder
        ).offset();

        this.newConnection.xEnd =
          this.scaleCorrectedPosition(e.clientX) -
          this.scaleCorrectedPosition(pipelineStepHolderOffset.left);
        this.newConnection.yEnd =
          this.scaleCorrectedPosition(e.clientY) -
          this.scaleCorrectedPosition(pipelineStepHolderOffset.top);
        this.newConnection.render();

        // check for hovering over incoming-connections div
        if ($(e.target).hasClass("incoming-connections")) {
          $(e.target).addClass("hover");
        } else {
          $(".incoming-connections").removeClass("hover");
        }
      }
    });
  }

  initializePipelineNavigationListeners() {
    $(this.refManager.refs.pipelineStepsHolder).on(
      "mousedown",
      ".pipeline-step",
      (e) => {
        if (e.button === 0) {
          if (!$(e.target).hasClass("outgoing-connections")) {
            let stepUUID = $(e.currentTarget).attr("data-uuid");
            this.selectedItem = stepUUID;
          }
        }
      }
    );

    $(document).on("mouseup.initializePipeline", (e) => {
      let stepClicked = false;
      let stepDragged = false;

      if (this.selectedItem !== undefined) {
        let step = this.state.steps[this.selectedItem];

        if (!step.meta_data._dragged) {
          if (this.selectedConnection) {
            this.deselectConnection();
          }

          if (!e.ctrlKey) {
            stepClicked = true;

            if (this.doubleClickFirstClick) {
              this.refManager.refs[this.selectedItem].props.onDoubleClick(
                this.selectedItem
              );
            } else {
              this.refManager.refs[this.selectedItem].props.onClick(
                this.selectedItem
              );
            }

            this.doubleClickFirstClick = true;
            clearTimeout(this.doubleClickTimeout);
            this.doubleClickTimeout = setTimeout(() => {
              this.doubleClickFirstClick = false;
            }, this.DOUBLE_CLICK_TIMEOUT);
          } else {
            // if clicked step is not selected, select it on Ctrl+Mouseup
            if (this.state.selectedSteps.indexOf(this.selectedItem) === -1) {
              this.state.selectedSteps = this.state.selectedSteps.concat(
                this.selectedItem
              );

              this.setState({
                selectedSteps: this.state.selectedSteps,
              });
            } else {
              // remove from selection
              this.state.selectedSteps.splice(
                this.state.selectedSteps.indexOf(this.selectedItem),
                1
              );

              this.setState({
                selectedSteps: this.state.selectedSteps,
              });
            }
          }
        } else {
          stepDragged = true;
        }

        step.meta_data._dragged = false;
        step.meta_data._drag_count = 0;
      }

      // check if step needs to be selected based on selectedSteps
      if (this.state.stepSelector.active || this.selectedItem !== undefined) {
        if (this.selectedConnection) {
          this.deselectConnection();
        }

        if (
          this.state.selectedSteps.length == 1 &&
          !stepClicked &&
          !stepDragged
        ) {
          this.selectStep(this.state.selectedSteps[0]);
        } else if (this.state.selectedSteps.length > 1 && !stepDragged) {
          // make sure single step detail view is closed
          this.closeDetailsView();

          // show multistep view
          this.setState({
            openedMultistep: true,
          });
        } else {
          this.deselectSteps();
        }
      }

      // handle step selector
      if (this.state.stepSelector.active) {
        // on mouse up trigger onClick if single step is selected
        // (only if not triggered by clickEnd)
        this.state.stepSelector.active = false;
        this.setState({
          stepSelector: this.state.stepSelector,
        });
      }

      if (stepDragged) {
        // Trigger save through event queue (for perfomance)
        setTimeout(() => {
          this.savePipeline();
        }, 1);
      }

      if (e.button === 0 && this.state.selectedSteps.length == 0) {
        // when space bar is held make sure deselection does not occur
        // on click (as it is a drag event)

        if (
          (e.target === this.refManager.refs.pipelineStepsOuterHolder ||
            e.target === this.refManager.refs.pipelineStepsHolder) &&
          this.draggingPipeline !== true
        ) {
          if (this.selectedConnection) {
            this.deselectConnection();
          }

          this.deselectSteps();
        }
      }

      // using timeouts to set global (this) after all event listeners
      // have processed.
      setTimeout(() => {
        this.selectedItem = undefined;

        if (this.draggingPipeline) {
          this.draggingPipeline = false;
        }
      }, 1);
    });

    $(this.refManager.refs.pipelineStepsHolder).on("mousedown", (e) => {
      this.prevPosition = [
        this.scaleCorrectedPosition(e.clientX),
        this.scaleCorrectedPosition(e.clientY),
      ];
    });

    let _this = this;
    $(this.refManager.refs.pipelineStepsHolder).on(
      "mousedown",
      "#path-clickable",
      function (e) {
        if (e.button === 0 && !_this.keysDown[32]) {
          if (_this.selectedConnection) {
            _this.selectedConnection.deselectState();
          }

          _this.deselectSteps();

          let connection = $(this).parents("svg").parents(".connection");
          let startNodeUUID = connection.attr("data-start-uuid");
          let endNodeUUID = connection.attr("data-end-uuid");

          _this.selectedConnection = _this.getConnectionByUUIDs(
            startNodeUUID,
            endNodeUUID
          );

          _this.selectedConnection.selectState();
        }
      }
    );

    $(document).on("mousedown.initializePipeline", (e) => {
      const serviceClass = "services-status";
      if (
        $(e.target).parents("." + serviceClass).length == 0 &&
        !$(e.target).hasClass(serviceClass)
      ) {
        this.hideServices();
      }
    });

    $(document).on("keydown.initializePipeline", (e) => {
      if (e.keyCode == 72) {
        this.centerView();
      }

      this.keysDown[e.keyCode] = true;
    });

    $(document).on("keyup.initializePipeline", (e) => {
      this.keysDown[e.keyCode] = false;

      if (e.keyCode) {
        $(this.refManager.refs.pipelineStepsOuterHolder).removeClass(
          "dragging"
        );
        this.draggingPipeline = false;
      }

      if (e.keyCode === 27) {
        if (this.selectedConnection) {
          this.deselectConnection();
        }

        this.deselectSteps();
        this.closeDetailsView();
        this.hideServices();
      }
    });
  }

  initializePipeline() {
    // Initialize should be called only once
    // this.state.steps is assumed to be populated
    // called after render, assumed dom elements are also available
    // (required by i.e. connections)

    this.pipelineSetHolderSize();
    this.renderPipelineHolder();

    if (this.initializedPipeline) {
      console.error("PipelineView component should only be initialized once.");
      return;
    } else {
      this.initializedPipeline = true;
    }

    // add all existing connections (this happens only at initialization)
    for (let key in this.state.steps) {
      if (this.state.steps.hasOwnProperty(key)) {
        let step = this.state.steps[key];

        for (let x = 0; x < step.incoming_connections.length; x++) {
          let startNodeUUID = step.incoming_connections[x];
          let endNodeUUID = step.uuid;

          let startNodeOutgoingEl = $(
            this.refManager.refs.pipelineStepsHolder
          ).find(
            ".pipeline-step[data-uuid='" +
              startNodeUUID +
              "'] .outgoing-connections"
          );

          let endNodeIncomingEl = $(
            this.refManager.refs.pipelineStepsHolder
          ).find(
            ".pipeline-step[data-uuid='" +
              endNodeUUID +
              "'] .incoming-connections"
          );

          if (startNodeOutgoingEl.length > 0 && endNodeIncomingEl.length > 0) {
            this.createConnection(startNodeOutgoingEl, endNodeIncomingEl);
          }
        }
      }
    }

    // initialize all listeners related to viewing/navigating the pipeline
    this.initializePipelineNavigationListeners();

    if (this.props.queryArgs.read_only !== "true") {
      // initialize all listeners related to editing the pipeline
      this.initializePipelineEditListeners();
    }
  }

  fetchPipelineAndInitialize() {
    let pipelineJSONEndpoint = getPipelineJSONEndpoint(
      this.props.queryArgs.pipeline_uuid,
      this.props.queryArgs.project_uuid,
      this.props.queryArgs.job_uuid,
      this.props.queryArgs.run_uuid
    );

    let fetchPipelinePromise = makeCancelable(
      makeRequest("GET", pipelineJSONEndpoint),
      this.promiseManager
    );

    // fetch pipeline cwd
    let cwdFetchPromise = makeCancelable(
      makeRequest(
        "GET",
        `/async/file-picker-tree/pipeline-cwd/${this.props.queryArgs.project_uuid}/${this.props.queryArgs.pipeline_uuid}`
      ),
      this.promiseManager
    );

    fetchPipelinePromise.promise.catch((error) => {
      if (!error.isCanceled) {
        if (this.props.queryArgs.job_uuid) {
          // This case is hit when a user tries to load a pipeline that belongs
          // to a run that has not started yet. The project files are only
          // copied when the run starts. Before start, the pipeline.json thus
          // cannot be found. Alert the user about missing pipeline and return
          // to JobView.

          orchest.alert(
            "Error",
            "The .orchest pipeline file could not be found. This pipeline run has not been started. Returning to Job view.",
            () => {
              orchest.loadView(JobView, {
                queryArgs: {
                  job_uuid: this.props.queryArgs.job_uuid,
                },
              });
            }
          );
        } else {
          console.error("Could not load pipeline.json");
          console.error(error);
        }
      }
    });

    Promise.all([cwdFetchPromise.promise, fetchPipelinePromise.promise])
      .then(([cwdPromiseResult, fetchPipelinePromiseResult]) => {
        // relativeToAbsolutePath expects trailing / for directories
        let cwd = JSON.parse(cwdPromiseResult)["cwd"] + "/";
        this.setState({
          pipelineCwd: cwd,
        });

        let result = JSON.parse(fetchPipelinePromiseResult);
        if (result.success) {
          this.decodeJSON(JSON.parse(result["pipeline_json"]));

          this.context.dispatch({
            type: "pipelineUpdateReadOnlyState",
            payload: this.props.queryArgs.read_only === "true",
          });

          this.context.dispatch({
            type: "pipelineSet",
            payload: {
              pipeline_uuid: this.props.queryArgs.pipeline_uuid,
              project_uuid: this.props.queryArgs.project_uuid,
              pipelineName: this.state.pipelineJson.name,
            },
          });

          this.initializePipeline();
        } else {
          console.error("Could not load pipeline.json");
          console.error(result);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  updateJupyterInstance() {
    const session = this.context.get.session(this.props.queryArgs);
    const base_url = session?.notebook_server_info?.base_url;

    if (base_url) {
      let baseAddress = "//" + window.location.host + base_url;
      orchest.jupyter.updateJupyterInstance(baseAddress);
    }
  }

  newStep() {
    this.deselectSteps();

    let environmentsEndpoint = `/store/environments/${this.props.queryArgs.project_uuid}`;
    let fetchEnvironmentsPromise = makeCancelable(
      makeRequest("GET", environmentsEndpoint),
      this.promiseManager
    );

    fetchEnvironmentsPromise.promise.then((response) => {
      let result = JSON.parse(response);

      let environmentUUID = "";
      let environmentName = "";

      if (result.length > 0) {
        environmentUUID = result[0].uuid;
        environmentName = result[0].name;
      }

      let step = {
        title: "",
        uuid: uuidv4(),
        incoming_connections: [],
        file_path: "",
        kernel: {
          name: "python",
          display_name: environmentName,
        },
        environment: environmentUUID,
        parameters: {},
        meta_data: {
          position: [0, 0],
          _dragged: false,
          _drag_count: 0,
          hidden: true,
        },
      };

      this.state.steps[step.uuid] = step;
      this.setState({ steps: this.state.steps });

      this.selectStep(step.uuid);

      // wait for single render call
      setTimeout(() => {
        step["meta_data"]["position"] = [
          -this.pipelineOffset[0] +
            this.refManager.refs.pipelineStepsOuterHolder.clientWidth / 2 -
            190 / 2,
          -this.pipelineOffset[1] +
            this.refManager.refs.pipelineStepsOuterHolder.clientHeight / 2 -
            105 / 2,
        ];

        // to avoid repositioning flash (creating a step can affect the size of the viewport)
        step["meta_data"]["hidden"] = false;

        this.setState({ steps: this.state.steps });
        this.refManager.refs[step.uuid].updatePosition(
          this.state.steps[step.uuid].meta_data.position
        );

        this.savePipeline();
      }, 0);
    });
  }

  selectStep(pipelineStepUUID) {
    if (this.state.openedStep) {
      this.setState({ openedStep: undefined });
    }

    this.state.openedStep = pipelineStepUUID;

    this.setState({
      openedStep: pipelineStepUUID,
      selectedSteps: [pipelineStepUUID],
    });
  }

  onClickStepHandler(stepUUID) {
    // as the selectStep is quite expensive (trigger large React render)
    // we free up the event loop queue by calling it through setTimeout
    setTimeout(() => {
      this.selectStep(stepUUID);
    });
  }

  onDoubleClickStepHandler(stepUUID) {
    if (this.props.queryArgs.read_only === "true") {
      this.onOpenFilePreviewView(stepUUID);
    } else {
      this.openNotebook(stepUUID);
    }
  }

  stepNameUpdate(pipelineStepUUID, title, file_path) {
    this.state.steps[pipelineStepUUID].title = title;
    this.state.steps[pipelineStepUUID].file_path = file_path;
    this.setState({ steps: this.state.steps });
  }

  makeConnection(sourcePipelineStepUUID, targetPipelineStepUUID) {
    if (
      this.state.steps[targetPipelineStepUUID].incoming_connections.indexOf(
        sourcePipelineStepUUID
      ) === -1
    ) {
      this.state.steps[targetPipelineStepUUID].incoming_connections.push(
        sourcePipelineStepUUID
      );
    }

    this.forceUpdate();
    this.savePipeline();
  }

  getStepExecutionState(stepUUID) {
    if (this.state.stepExecutionState[stepUUID]) {
      return this.state.stepExecutionState[stepUUID];
    } else {
      return { status: "idle" };
    }
  }

  setStepExecutionState(stepUUID, executionState) {
    this.state.stepExecutionState[stepUUID] = executionState;

    this.setState({
      stepExecutionState: this.state.stepExecutionState,
    });
  }

  removeConnection(sourcePipelineStepUUID, targetPipelineStepUUID) {
    let connectionIndex = this.state.steps[
      targetPipelineStepUUID
    ].incoming_connections.indexOf(sourcePipelineStepUUID);
    if (connectionIndex !== -1) {
      this.state.steps[targetPipelineStepUUID].incoming_connections.splice(
        connectionIndex,
        1
      );
    }

    this.savePipeline();
  }

  deleteSelectedSteps() {
    // The if is to avoid the dialog appearing when no steps are
    // selected and the delete button is pressed.
    if (this.state.selectedSteps.length > 0) {
      this.setState({
        isDeletingStep: true,
      });

      orchest.confirm(
        "Warning",
        "A deleted step and its logs cannot be recovered once deleted, are you" +
          " sure you want to proceed?",
        () => {
          this.closeMultistepView();
          this.closeDetailsView();

          // DeleteStep is going to remove the step from this.state.selected
          // Steps, modifying the collection while we are iterating on it.
          let stepsToRemove = this.state.selectedSteps.slice();
          for (let x = 0; x < stepsToRemove.length; x++) {
            this.deleteStep(stepsToRemove[x]);
          }

          this.setState({
            selectedSteps: [],
            isDeletingStep: false,
          });
          this.savePipeline();
        },
        () => {
          this.setState({
            isDeletingStep: false,
          });
        }
      );
    }
  }

  deleteStep(uuid) {
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
      let connection = this.getConnectionByUUIDs(
        step.incoming_connections[x],
        uuid
      );
      this.connections.splice(this.connections.indexOf(connection), 1);
      connection.remove();
    }

    delete this.state.steps[uuid];

    // if step is in selectedSteps remove
    let deletedStepIndex = this.state.selectedSteps.indexOf(uuid);
    if (deletedStepIndex >= 0) {
      this.state.selectedSteps.splice(deletedStepIndex, 1);
    }

    this.setState({
      selectedSteps: this.state.selectedSteps,
      steps: this.state.steps,
    });
  }

  onDetailsDelete() {
    let uuid = this.state.openedStep;
    orchest.confirm(
      "Warning",
      "A deleted step and its logs cannot be recovered once deleted, are you" +
        " sure you want to proceed?",
      () => {
        this.setState({
          openedStep: undefined,
          selectedSteps: [],
        });
        this.deleteStep(uuid);
        this.savePipeline();
      }
    );
  }

  openNotebook(stepUUID) {
    const session = this.context.get.session(this.props.queryArgs);

    if (session === undefined) {
      orchest.alert(
        "Error",
        "Please start the session before opening the Notebook in Jupyter."
      );
    } else if (session.status === "RUNNING") {
      orchest.loadView(JupyterLabView, {
        queryArgs: {
          pipeline_uuid: this.props.queryArgs.pipeline_uuid,
          project_uuid: this.props.queryArgs.project_uuid,
        },
      });

      orchest.jupyter.navigateTo(
        collapseDoubleDots(
          this.state.pipelineCwd + this.state.steps[stepUUID].file_path
        ).slice(1)
      );
    } else if (session.status === "LAUNCHING") {
      orchest.alert(
        "Error",
        "Please wait for the session to start before opening the Notebook in Jupyter."
      );
    } else {
      orchest.alert(
        "Error",
        "Please start the session before opening the Notebook in Jupyter."
      );
    }
  }

  onOpenFilePreviewView(step_uuid) {
    orchest.loadView(FilePreviewView, {
      queryArgs: {
        project_uuid: this.props.queryArgs.project_uuid,
        pipeline_uuid: this.props.queryArgs.pipeline_uuid,
        job_uuid: this.props.queryArgs.job_uuid,
        run_uuid: this.props.queryArgs.run_uuid,
        step_uuid: step_uuid,
        read_only: this.props.queryArgs.read_only,
      },
    });
  }

  onOpenNotebook() {
    this.openNotebook(this.state.openedStep);
  }

  parseRunStatuses(result) {
    if (
      result.pipeline_steps === undefined ||
      result.pipeline_steps.length === undefined
    ) {
      console.error(
        "Did not contain pipeline_steps list. Invalid `result` object"
      );
    }

    for (let x = 0; x < result.pipeline_steps.length; x++) {
      // finished_time takes priority over started_time
      let started_time = undefined;
      let finished_time = undefined;
      let server_time = serverTimeToDate(result.server_time);

      if (result.pipeline_steps[x].started_time) {
        started_time = serverTimeToDate(result.pipeline_steps[x].started_time);
      }
      if (result.pipeline_steps[x].finished_time) {
        finished_time = serverTimeToDate(
          result.pipeline_steps[x].finished_time
        );
      }

      this.setStepExecutionState(result.pipeline_steps[x].step_uuid, {
        status: result.pipeline_steps[x].status,
        started_time: started_time,
        finished_time: finished_time,
        server_time: server_time,
      });
    }
  }

  pollPipelineStepStatuses() {
    if (this.state.runUUID) {
      let pollPromise = makeCancelable(
        makeRequest("GET", this.state.runStatusEndpoint + this.state.runUUID),
        this.promiseManager
      );

      pollPromise.promise
        .then((response) => {
          let result = JSON.parse(response);

          this.parseRunStatuses(result);

          if (["PENDING", "STARTED"].indexOf(result.status) !== -1) {
            this.setState({
              pipelineRunning: true,
            });
          }

          if (["SUCCESS", "ABORTED", "FAILURE"].includes(result.status)) {
            // make sure stale opened files are reloaded in active
            // Jupyter instance

            orchest.jupyter.reloadFilesFromDisk();

            this.setState({
              pipelineRunning: false,
              waitingOnCancel: false,
            });
            clearInterval(this.pipelineStepStatusPollingInterval);
          }
        })
        .catch((error) => {
          console.warn(error);
        });
    }
  }

  centerView() {
    this.pipelineOffset[0] = this.INITIAL_PIPELINE_POSITION[0];
    this.pipelineOffset[1] = this.INITIAL_PIPELINE_POSITION[1];
    this.scaleFactor = 1;

    this.pipelineSetHolderOrigin([0, 0]);

    $(this.refManager.refs.pipelineStepsHolder).css({
      left: 0,
      top: 0,
    });

    this.renderPipelineHolder();
  }

  centerPipelineOrigin() {
    let pipelineStepsOuterHolderJ = $(
      this.refManager.refs.pipelineStepsOuterHolder
    );
    let pipelineStepsOuterHolderOffset = $(
      this.refManager.refs.pipelineStepsOuterHolder
    ).offset();
    let pipelineStepsHolderOffset = $(
      this.refManager.refs.pipelineStepsHolder
    ).offset();

    let centerOrigin = [
      this.scaleCorrectedPosition(
        pipelineStepsOuterHolderOffset.left -
          pipelineStepsHolderOffset.left +
          pipelineStepsOuterHolderJ.width() / 2
      ),
      this.scaleCorrectedPosition(
        pipelineStepsOuterHolderOffset.top -
          pipelineStepsHolderOffset.top +
          pipelineStepsOuterHolderJ.height() / 2
      ),
    ];

    this.pipelineSetHolderOrigin(centerOrigin);
  }

  zoomOut() {
    this.centerPipelineOrigin();
    this.scaleFactor = Math.max(this.scaleFactor - 0.25, 0.25);
    this.renderPipelineHolder();
  }

  zoomIn() {
    this.centerPipelineOrigin();
    this.scaleFactor = Math.min(this.scaleFactor + 0.25, 2);
    this.renderPipelineHolder();
  }

  scaleCorrectedPosition(position) {
    position /= this.scaleFactor;
    return position;
  }

  pipelineSetHolderOrigin(newOrigin) {
    this.pipelineOrigin = newOrigin;

    let pipelineStepsHolderOffset = $(
      this.refManager.refs.pipelineStepsHolder
    ).offset();

    let pipelineStepsOuterHolderOffset = $(
      this.refManager.refs.pipelineStepsOuterHolder
    ).offset();

    let initialX =
      pipelineStepsHolderOffset.left - pipelineStepsOuterHolderOffset.left;
    let initialY =
      pipelineStepsHolderOffset.top - pipelineStepsOuterHolderOffset.top;

    let translateXY = this.originTransformScaling(
      [...this.pipelineOrigin],
      this.scaleFactor
    );
    $(this.refManager.refs.pipelineStepsHolder).css({
      left: translateXY[0] + initialX - this.pipelineOffset[0],
      top: translateXY[1] + initialY - this.pipelineOffset[1],
    });
  }

  onPipelineStepsOuterHolderWheel(e) {
    let pipelineMousePosition = this.getMousePositionRelativeToPipelineStepHolder();

    // set origin at scroll wheel trigger
    if (
      pipelineMousePosition[0] != this.pipelineOrigin[0] ||
      pipelineMousePosition[1] != this.pipelineOrigin[1]
    ) {
      this.pipelineSetHolderOrigin(pipelineMousePosition);
    }

    /* mouseWheel contains information about the deltaY variable
     * WheelEvent.deltaMode can be:
     * DOM_DELTA_PIXEL = 0x00
     * DOM_DELTA_LINE = 0x01 (only used in Firefox)
     * DOM_DELTA_PAGE = 0x02 (which we'll treat identically to DOM_DELTA_LINE)
     */

    let deltaY = e.nativeEvent.deltaY;
    if (e.nativeEvent.deltaMode == 0x01 || e.nativeEvent.deltaMode == 0x02) {
      deltaY = getScrollLineHeight() * deltaY;
    }
    this.scaleFactor -= deltaY / 3000;
    this.scaleFactor = Math.min(Math.max(this.scaleFactor, 0.25), 2);

    this.renderPipelineHolder();
  }

  runSelectedSteps() {
    this.runStepUUIDs(this.state.selectedSteps, "selection");
  }
  onRunIncoming() {
    this.runStepUUIDs(this.state.selectedSteps, "incoming");
  }

  cancelRun() {
    if (!this.state.pipelineRunning) {
      orchest.alert("Error", "There is no pipeline running.");
      return;
    }

    ((runUUID) => {
      makeRequest("DELETE", `/catch/api-proxy/api/runs/${runUUID}`)
        .then(() => {
          this.setState({
            waitingOnCancel: true,
          });
        })
        .catch((response) => {
          orchest.alert(
            "Error",
            `Could not cancel pipeline run for runUUID ${runUUID}`
          );
        });
    })(this.state.runUUID);
  }

  _runStepUUIDs(uuids, type) {
    this.setState({
      pipelineRunning: true,
    });

    // store pipeline.json
    let data = {
      uuids: uuids,
      project_uuid: this.props.queryArgs.project_uuid,
      run_type: type,
      pipeline_definition: this.getPipelineJSON(),
    };

    let runStepUUIDsPromise = makeCancelable(
      makeRequest("POST", "/catch/api-proxy/api/runs/", {
        type: "json",
        content: data,
      }),
      this.promiseManager
    );

    runStepUUIDsPromise.promise
      .then((response) => {
        let result = JSON.parse(response);

        this.parseRunStatuses(result);

        this.setState({
          runUUID: result.uuid,
        });

        this.startStatusInterval();
      })
      .catch((response) => {
        if (!response.isCanceled) {
          this.setState({
            pipelineRunning: false,
          });

          try {
            let data = JSON.parse(response.body);
            orchest.alert(
              "Error",
              "Failed to start interactive run. " + data["message"]
            );
          } catch {
            orchest.alert(
              "Error",
              "Failed to start interactive run. Unknown error."
            );
          }
        }
      });
  }

  runStepUUIDs(uuids, type) {
    const session = this.context.get.session(this.props.queryArgs);

    if (session.status !== "RUNNING") {
      orchest.alert(
        "Error",
        "There is no active session. Please start the session first."
      );
      return;
    }

    if (this.state.pipelineRunning) {
      orchest.alert(
        "Error",
        "The pipeline is currently executing, please wait until it completes."
      );
      return;
    }

    this.savePipeline(() => {
      this._runStepUUIDs(uuids, type);
    });
  }

  startStatusInterval() {
    // initialize interval
    this.pipelineStepStatusPollingInterval = setInterval(
      this.pollPipelineStepStatuses.bind(this),
      this.STATUS_POLL_FREQUENCY
    );
  }

  onCloseDetails() {
    this.closeDetailsView();
  }

  closeDetailsView() {
    this.setState({
      openedStep: undefined,
    });
  }

  closeMultistepView() {
    this.setState({
      openedMultistep: undefined,
    });
  }

  onCloseMultistep() {
    this.closeMultistepView();
  }

  onDeleteMultistep() {
    this.deleteSelectedSteps();
  }

  onDetailsChangeView(newIndex) {
    this.setState({
      defaultDetailViewIndex: newIndex,
    });
  }

  onSaveDetails(updatedStep) {
    // update step state based on latest state of pipelineDetails component

    // update steps in setState even though reference objects are directly modified - this propagates state updates properly
    this.state.steps[updatedStep.uuid] = updatedStep;

    this.setState({
      steps: this.state.steps,
    });

    this.savePipeline();
  }

  deselectSteps() {
    // deselecting will close the detail view
    this.closeDetailsView();
    this.onCloseMultistep();

    this.state.stepSelector.x1 = Number.MIN_VALUE;
    this.state.stepSelector.y1 = Number.MIN_VALUE;
    this.state.stepSelector.x2 = Number.MIN_VALUE;
    this.state.stepSelector.y2 = Number.MIN_VALUE;
    this.state.stepSelector.active = false;

    this.setState({
      stepSelector: this.state.stepSelector,
      selectedSteps: [],
    });
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
          if (this.refManager.refs[uuid]) {
            let stepDom = $(
              this.refManager.refs[uuid].refManager.refs.container
            );

            let stepRect = {
              x: step.meta_data.position[0],
              y: step.meta_data.position[1],
              width: stepDom.outerWidth(),
              height: stepDom.outerHeight(),
            };

            if (intersectRect(rect, stepRect)) {
              selectedSteps.push(uuid);
            }
          }
        }
      }
    }

    return selectedSteps;
  }

  pipelineSetHolderSize() {
    // TODO: resize canvas based on pipeline size
    let jElStepOuterHolder = $(this.refManager.refs.pipelineStepsOuterHolder);

    if (jElStepOuterHolder.filter(":visible").length > 0) {
      $(this.refManager.refs.pipelineStepsHolder).css({
        width: jElStepOuterHolder.width() * this.CANVAS_VIEW_MULTIPLE,
        height: jElStepOuterHolder.height() * this.CANVAS_VIEW_MULTIPLE,
      });
    }
  }

  getMousePositionRelativeToPipelineStepHolder() {
    let pipelineStepsolderOffset = $(
      this.refManager.refs.pipelineStepsHolder
    ).offset();

    return [
      this.scaleCorrectedPosition(
        this.mouseClientX - pipelineStepsolderOffset.left
      ),
      this.scaleCorrectedPosition(
        this.mouseClientY - pipelineStepsolderOffset.top
      ),
    ];
  }

  originTransformScaling(origin, scaleFactor) {
    /* By multiplying the transform-origin with the scaleFactor we get the right
     * displacement for the transformed/scaled parent (pipelineStepHolder)
     * that avoids visual displacement when the origin of the
     * transformed/scaled parent is modified.
     *
     * the adjustedScaleFactor was derived by analysing the geometric behavior
     * of applying the css transform: translate(...) scale(...);.
     */

    let adjustedScaleFactor = scaleFactor - 1;
    origin[0] *= adjustedScaleFactor;
    origin[1] *= adjustedScaleFactor;
    return origin;
  }

  servicesAvailable() {
    const session = this.context.get.session(this.props.queryArgs);
    if (
      (!this.props.queryArgs.job_uuid &&
        session &&
        session.status == "RUNNING") ||
      (this.props.queryArgs.job_uuid &&
        this.state.pipelineJson &&
        this.state.pipelineRunning)
    ) {
      return Object.keys(this.getServices()).length > 0;
    } else {
      return false;
    }
  }

  renderPipelineHolder() {
    $(this.refManager.refs.pipelineStepsHolder).css({
      transformOrigin: `${this.pipelineOrigin[0]}px ${this.pipelineOrigin[1]}px`,
      transform:
        "translateX(" +
        this.pipelineOffset[0] +
        "px)" +
        "translateY(" +
        this.pipelineOffset[1] +
        "px)" +
        "scale(" +
        this.scaleFactor +
        ")",
    });
  }

  onPipelineStepsOuterHolderDown(e) {
    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;

    if (e.button === 0) {
      if (this.keysDown[32]) {
        // space held while clicking, means canvas drag
        $(this.refManager.refs.pipelineStepsOuterHolder).addClass("dragging");
        this.draggingPipeline = true;
      }
    }

    if (
      ($(e.target).hasClass("pipeline-steps-holder") ||
        $(e.target).hasClass("pipeline-steps-outer-holder")) &&
      e.button === 0
    ) {
      if (!this.draggingPipeline) {
        let pipelineStepHolderOffset = $(".pipeline-steps-holder").offset();

        this.state.stepSelector.active = true;
        this.state.stepSelector.x1 = this.state.stepSelector.x2 =
          this.scaleCorrectedPosition(e.clientX) -
          this.scaleCorrectedPosition(pipelineStepHolderOffset.left);
        this.state.stepSelector.y1 = this.state.stepSelector.y2 =
          this.scaleCorrectedPosition(e.clientY) -
          this.scaleCorrectedPosition(pipelineStepHolderOffset.top);

        this.setState({
          stepSelector: this.state.stepSelector,
          selectedSteps: this.getSelectedSteps(),
        });
      }
    }
  }

  onPipelineStepsOuterHolderMove(e) {
    if (this.state.stepSelector.active) {
      let pipelineStepHolderOffset = $(
        this.refManager.refs.pipelineStepsHolder
      ).offset();

      this.state.stepSelector.x2 =
        this.scaleCorrectedPosition(e.clientX) -
        this.scaleCorrectedPosition(pipelineStepHolderOffset.left);
      this.state.stepSelector.y2 =
        this.scaleCorrectedPosition(e.clientY) -
        this.scaleCorrectedPosition(pipelineStepHolderOffset.top);

      this.setState({
        stepSelector: this.state.stepSelector,
        selectedSteps: this.getSelectedSteps(),
      });
    }

    if (this.draggingPipeline) {
      let dx = e.clientX - this.mouseClientX;
      let dy = e.clientY - this.mouseClientY;

      this.pipelineOffset[0] += dx;
      this.pipelineOffset[1] += dy;

      this.renderPipelineHolder();
    }

    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;
  }

  getServices() {
    let services;
    if (!this.props.queryArgs.job_uuid) {
      const session = this.context.get.session(this.props.queryArgs);
      if (session && session.user_services) {
        services = session.user_services;
      }
    } else {
      services = this.state.pipelineJson.services;
    }

    // Filter services based on scope
    let scope = this.props.queryArgs.job_uuid
      ? "noninteractive"
      : "interactive";
    return filterServices(services, scope);
  }

  generateServiceEndpoints() {
    let serviceLinks = [];
    let services = this.getServices();

    for (let serviceName in services) {
      let service = services[serviceName];

      let urls = getServiceURLs(
        service,
        this.props.queryArgs.project_uuid,
        this.props.queryArgs.pipeline_uuid,
        this.props.queryArgs.run_uuid
      );

      let formatUrl = (url) => {
        return "Port " + url.split("/")[3].split("_").slice(-1)[0];
      };

      serviceLinks.push(<h4 key={serviceName}>{serviceName}</h4>);

      for (let url of urls) {
        serviceLinks.push(
          <div className="link-holder" key={url}>
            <a target="_blank" href={url}>
              <span className="material-icons">open_in_new</span>{" "}
              {formatUrl(url)}
            </a>
          </div>
        );
      }

      if (urls.length == 0) {
        serviceLinks.push(
          <i key={serviceName + "-i"}>This service has no endpoints.</i>
        );
      }
    }
    return <div>{serviceLinks}</div>;
  }

  getStepSelectorRectangle() {
    let rect = {
      x: Math.min(this.state.stepSelector.x1, this.state.stepSelector.x2),
      y: Math.min(this.state.stepSelector.y1, this.state.stepSelector.y2),
      width: Math.abs(this.state.stepSelector.x2 - this.state.stepSelector.x1),
      height: Math.abs(this.state.stepSelector.y2 - this.state.stepSelector.y1),
    };
    return rect;
  }

  returnToJob(job_uuid) {
    orchest.loadView(JobView, {
      queryArgs: {
        job_uuid,
      },
    });
  }

  render() {
    let pipelineSteps = [];

    for (let uuid in this.state.steps) {
      if (this.state.steps.hasOwnProperty(uuid)) {
        let step = this.state.steps[uuid];

        let selected = this.state.selectedSteps.indexOf(uuid) !== -1;

        // only add steps to the component that have been properly
        // initialized
        pipelineSteps.push(
          <PipelineStep
            key={step.uuid}
            step={step}
            selected={selected}
            ref={this.refManager.nrefs[step.uuid]}
            executionState={this.getStepExecutionState(step.uuid)}
            onConnect={this.makeConnection.bind(this)}
            onClick={this.onClickStepHandler.bind(this)}
            onDoubleClick={this.onDoubleClickStepHandler.bind(this)}
          />
        );
      }
    }

    let connections_list = [];
    if (this.state.openedStep) {
      let incoming_connections = this.state.steps[this.state.openedStep]
        .incoming_connections;

      for (var x = 0; x < incoming_connections.length; x++) {
        connections_list[incoming_connections[x]] = [
          this.state.steps[incoming_connections[x]].title,
          this.state.steps[incoming_connections[x]].file_path,
        ];
      }
    }

    let stepSelectorComponent = undefined;

    if (this.state.stepSelector.active) {
      let rect = this.getStepSelectorRectangle();

      stepSelectorComponent = (
        <div
          className="step-selector"
          style={{
            width: rect.width,
            height: rect.height,
            left: rect.x,
            top: rect.y,
          }}
        ></div>
      );
    }

    // Check if there is an incoming step (that is not part of the
    // selection).
    // This is checked to conditionally render the
    // 'Run incoming steps' button.
    let selectedStepsHasIncoming = false;
    for (let x = 0; x < this.state.selectedSteps.length; x++) {
      let step = this.state.steps[this.state.selectedSteps[x]];
      for (let i = 0; i < step.incoming_connections.length; i++) {
        let incomingStepUUID = step.incoming_connections[i];
        if (this.state.selectedSteps.indexOf(incomingStepUUID) < 0) {
          selectedStepsHasIncoming = true;
          break;
        }
      }
      if (selectedStepsHasIncoming) {
        break;
      }
    }

    return (
      <OrchestSessionsConsumer>
        <Layout>
          <div className="pipeline-view">
            <div className="pane pipeline-view-pane">
              {this.props.queryArgs.job_uuid &&
                this.props.queryArgs.read_only == "true" && (
                  <div className="pipeline-actions top-left">
                    <MDCButtonReact
                      classNames={["mdc-button--outlined"]}
                      label="Back to job"
                      icon="arrow_back"
                      onClick={this.returnToJob.bind(
                        this,
                        this.props.queryArgs.job_uuid
                      )}
                    />
                  </div>
                )}

              <div className="pipeline-actions bottom-left">
                <div className="navigation-buttons">
                  <MDCButtonReact
                    onClick={this.centerView.bind(this)}
                    icon="crop_free"
                  />
                  <MDCButtonReact
                    onClick={this.zoomOut.bind(this)}
                    icon="remove"
                  />
                  <MDCButtonReact onClick={this.zoomIn.bind(this)} icon="add" />
                </div>
                {(() => {
                  if (
                    this.state.selectedSteps.length > 0 &&
                    !this.state.stepSelector.active &&
                    this.props.queryArgs.read_only !== "true"
                  ) {
                    if (!this.state.pipelineRunning) {
                      return (
                        <div className="selection-buttons">
                          <MDCButtonReact
                            classNames={[
                              "mdc-button--raised",
                              "themed-secondary",
                            ]}
                            onClick={this.runSelectedSteps.bind(this)}
                            label="Run selected steps"
                          />
                          {selectedStepsHasIncoming && (
                            <MDCButtonReact
                              classNames={[
                                "mdc-button--raised",
                                "themed-secondary",
                              ]}
                              onClick={this.onRunIncoming.bind(this)}
                              label="Run incoming steps"
                            />
                          )}
                        </div>
                      );
                    }
                  }
                  if (
                    this.state.pipelineRunning &&
                    this.props.queryArgs.read_only !== "true"
                  ) {
                    return (
                      <div className="selection-buttons">
                        <MDCButtonReact
                          classNames={["mdc-button--raised"]}
                          onClick={this.cancelRun.bind(this)}
                          icon="close"
                          disabled={this.state.waitingOnCancel}
                          label="Cancel run"
                        />
                      </div>
                    );
                  }
                })()}
              </div>

              <div className={"pipeline-actions top-right"}>
                {this.props.queryArgs.read_only !== "true" && (
                  <MDCButtonReact
                    classNames={["mdc-button--raised"]}
                    onClick={this.newStep.bind(this)}
                    icon={"add"}
                    label={"NEW STEP"}
                  />
                )}

                {this.props.queryArgs.read_only === "true" && (
                  <MDCButtonReact
                    label={"Read only"}
                    disabled={true}
                    icon={"visibility"}
                  />
                )}

                <MDCButtonReact
                  classNames={["mdc-button--raised"]}
                  onClick={this.openLogs.bind(this)}
                  label={"Logs"}
                  icon="view_headline"
                />

                {this.servicesAvailable() && (
                  <MDCButtonReact
                    classNames={["mdc-button--raised"]}
                    onClick={this.showServices.bind(this)}
                    label={"Services"}
                    icon="settings"
                  />
                )}

                <MDCButtonReact
                  classNames={["mdc-button--raised"]}
                  onClick={this.openSettings.bind(this, undefined)}
                  label={"Settings"}
                  icon="tune"
                />

                {this.state.showServices && this.servicesAvailable() && (
                  <div className="services-status">
                    <h3>Running services</h3>
                    {this.generateServiceEndpoints()}

                    <div className="edit-button-holder">
                      <MDCButtonReact
                        icon="tune"
                        label={
                          (this.props.queryArgs.read_only !== "true"
                            ? "Edit"
                            : "View") + " services"
                        }
                        onClick={this.openSettings.bind(this, "services")}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                className="pipeline-steps-outer-holder"
                ref={this.refManager.nrefs.pipelineStepsOuterHolder}
                onMouseMove={this.onPipelineStepsOuterHolderMove.bind(this)}
                onMouseDown={this.onPipelineStepsOuterHolderDown.bind(this)}
                onWheel={this.onPipelineStepsOuterHolderWheel.bind(this)}
              >
                <div
                  className="pipeline-steps-holder"
                  ref={this.refManager.nrefs.pipelineStepsHolder}
                >
                  {stepSelectorComponent}
                  {pipelineSteps}
                </div>
              </div>
            </div>

            {(() => {
              if (this.state.openedStep) {
                return (
                  <PipelineDetails
                    onSave={this.onSaveDetails.bind(this)}
                    onNameUpdate={this.stepNameUpdate.bind(this)}
                    onDelete={this.onDetailsDelete.bind(this)}
                    onClose={this.onCloseDetails.bind(this)}
                    onOpenFilePreviewView={this.onOpenFilePreviewView.bind(
                      this
                    )}
                    onOpenNotebook={this.onOpenNotebook.bind(this)}
                    onChangeView={this.onDetailsChangeView.bind(this)}
                    connections={connections_list}
                    defaultViewIndex={this.state.defaultDetailViewIndex}
                    pipeline={this.state.pipelineJson}
                    pipelineCwd={this.state.pipelineCwd}
                    project_uuid={this.props.queryArgs.project_uuid}
                    job_uuid={this.props.queryArgs.job_uuid}
                    run_uuid={this.props.queryArgs.run_uuid}
                    sio={this.sio}
                    readOnly={this.props.queryArgs.read_only === "true"}
                    step={this.state.steps[this.state.openedStep]}
                    saveHash={this.state.saveHash}
                  />
                );
              }
              if (
                this.state.openedMultistep &&
                this.props.queryArgs.read_only !== "true"
              ) {
                return (
                  <div className={"pipeline-actions bottom-right"}>
                    <MDCButtonReact
                      classNames={["mdc-button--raised"]}
                      label={"Delete"}
                      onClick={this.onDeleteMultistep.bind(this)}
                      icon={"delete"}
                    />
                  </div>
                );
              }
            })()}
          </div>
        </Layout>
      </OrchestSessionsConsumer>
    );
  }
}

export default PipelineView;
