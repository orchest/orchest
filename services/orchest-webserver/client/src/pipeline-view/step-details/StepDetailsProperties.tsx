import ProjectFilePicker from "@/pipeline-view/step-details/ProjectFilePicker";
import { PipelineStepState, Step } from "@/types";
import { toValidFilename } from "@/utils/toValidFilename";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  extensionFromFilename,
  joinRelativePaths,
  kernelNameToLanguage,
  RefManager,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import $ from "jquery";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { SelectEnvironment } from "./SelectEnvironment";

export type ConnectionDict = Record<
  string,
  { title: string; file_path: string }
>;

const ConnectionItem = ({
  uuid,
  title,
  filePath,
}: {
  uuid: string;
  title: string;
  filePath: string;
}) => {
  return (
    <div className="connection-item" data-uuid={uuid}>
      <i className="material-icons">drag_indicator</i> <span>{title}</span>{" "}
      <span className="filename">({filePath})</span>
    </div>
  );
};

const KERNEL_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "julia", label: "Julia" },
  { value: "javascript", label: "JavaScript" },
];

export const StepDetailsProperties = ({
  pipelineCwd,
  readOnly,
  connections,
  step,
  onSave,
  menuMaxWidth,
}: {
  pipelineCwd: string | undefined;
  readOnly: boolean;
  connections: ConnectionDict;
  step: PipelineStepState;
  onSave: (payload: Partial<Step>, uuid: string, replace?: boolean) => void;
  menuMaxWidth?: string;
}) => {
  // Allows user to edit JSON while typing the text will not be valid JSON.
  const [editableParameters, setEditableParameters] = React.useState(
    JSON.stringify(step.parameters, null, 2)
  );

  const refManager = React.useMemo(() => new RefManager(), []);

  const isNotebookStep = extensionFromFilename(step.file_path) === "ipynb";

  const onChangeEnvironment = React.useCallback(
    (
      updatedEnvironmentUUID: string,
      updatedEnvironmentName: string,
      skipSave?: boolean
    ) => {
      if (!skipSave) {
        onSave(
          {
            environment: updatedEnvironmentUUID,
            kernel: { display_name: updatedEnvironmentName },
          },
          step.uuid,
          false
        );
        if (
          pipelineCwd &&
          updatedEnvironmentUUID.length > 0 &&
          step.file_path.length > 0
        ) {
          window.orchest.jupyter?.setNotebookKernel(
            joinRelativePaths(pipelineCwd, step.file_path),
            `orchest-kernel-${updatedEnvironmentUUID}`
          );
        }
      }
    },
    [onSave, pipelineCwd, step]
  );

  // Mostly for new steps, where user is assumed to start typing Step Title,
  // then Step File Path is then automatically generated.
  const autogenerateFilePath = React.useRef(step.file_path.length === 0);

  const onChangeFilePath = React.useCallback(
    (newFilePath: string) => {
      if (newFilePath.length > 0) {
        autogenerateFilePath.current = false;
      }
      if (newFilePath !== step.file_path)
        onSave({ file_path: newFilePath }, step.uuid);
    },
    [onSave, step.uuid, step.file_path]
  );

  const onChangeParameterJSON = (updatedParameterJSON: string) => {
    setEditableParameters(updatedParameterJSON);
    try {
      onSave({ parameters: JSON.parse(updatedParameterJSON) }, step.uuid, true);
    } catch (err) {}
  };

  const onChangeKernel = (updatedKernel: string) => {
    if (step.kernel.name !== updatedKernel)
      onSave({ kernel: { name: updatedKernel } }, step.uuid);
  };

  const onChangeTitle = (updatedTitle: string) => {
    const filePathChange = autogenerateFilePath.current
      ? { file_path: toValidFilename(updatedTitle) }
      : null;

    if (step.title !== updatedTitle || filePathChange)
      onSave({ title: updatedTitle, ...filePathChange }, step.uuid);
  };

  const swapConnectionOrder = (
    oldConnectionIndex: number,
    newConnectionIndex: number
  ) => {
    // check if there is work to do
    if (oldConnectionIndex != newConnectionIndex) {
      // note it's creating a reference
      let connectionList = cloneDeep(step.incoming_connections);

      let tmp = connectionList[oldConnectionIndex];
      connectionList.splice(oldConnectionIndex, 1);
      connectionList.splice(newConnectionIndex, 0, tmp);

      onSave({ incoming_connections: connectionList }, step.uuid);
    }
  };

  const setupConnectionListener = () => {
    // initiate draggable connections

    let previousPosition = 0;
    let connectionItemOffset = 0;
    let oldConnectionIndex = 0;
    let newConnectionIndex = 0;

    let numConnectionListItems = $(refManager.refs.connectionList).find(
      ".connection-item"
    ).length;

    $(refManager.refs.connectionList).on(
      "mousedown",
      ".connection-item",
      function (e) {
        previousPosition = e.clientY;
        connectionItemOffset = 0;

        $(refManager.refs.connectionList).addClass("dragging");

        oldConnectionIndex = $(this).index();

        $(this).addClass("selected");
      }
    );

    $(document).on("mousemove.connectionList", function (e) {
      let selectedConnection = $(refManager.refs.connectionList).find(
        ".connection-item.selected"
      );

      if (selectedConnection.length > 0) {
        const clientY = e.clientY as number;
        let positionDelta = clientY - previousPosition;

        previousPosition = clientY;

        let itemHeight = selectedConnection.outerHeight() as number;

        connectionItemOffset += positionDelta;

        // limit connectionItemOffset
        if (connectionItemOffset < -itemHeight * oldConnectionIndex) {
          connectionItemOffset = -itemHeight * oldConnectionIndex;
        } else if (
          connectionItemOffset >
          itemHeight * (numConnectionListItems - oldConnectionIndex - 1)
        ) {
          connectionItemOffset =
            itemHeight * (numConnectionListItems - oldConnectionIndex - 1);
        }

        selectedConnection.css({
          transform: "translateY(" + connectionItemOffset + "px)",
        });

        // find new index based on current position
        let elementYPosition =
          (oldConnectionIndex * itemHeight + connectionItemOffset) / itemHeight;

        newConnectionIndex = Math.min(
          Math.max(0, Math.round(elementYPosition)),
          numConnectionListItems - 1
        );

        // evaluate swap classes for all elements in list besides selectedConnection
        for (let i = 0; i < numConnectionListItems; i++) {
          if (i != oldConnectionIndex) {
            let connectionListItem = $(refManager.refs.connectionList)
              .find(".connection-item")
              .eq(i);

            connectionListItem.removeClass("swapped-up");
            connectionListItem.removeClass("swapped-down");

            if (newConnectionIndex >= i && i > oldConnectionIndex) {
              connectionListItem.addClass("swapped-up");
            } else if (newConnectionIndex <= i && i < oldConnectionIndex) {
              connectionListItem.addClass("swapped-down");
            }
          }
        }
      }
    });

    // Note, listener should be unmounted
    $(document).on("mouseup.connectionList", function () {
      let selectedConnection = $(refManager.refs.connectionList).find(
        ".connection-item.selected"
      );

      if (selectedConnection.length > 0) {
        selectedConnection.css({ transform: "" });
        selectedConnection.removeClass("selected");

        $(refManager.refs.connectionList)
          .find(".connection-item")
          .removeClass("swapped-up")
          .removeClass("swapped-down");

        $(refManager.refs.connectionList).removeClass("dragging");

        swapConnectionOrder(oldConnectionIndex, newConnectionIndex);
      }
    });
  };

  React.useEffect(() => {
    if (!readOnly) {
      // set focus on first field
      refManager.refs.titleTextField.focus();
    }
    if (step.file_path.length === 0) {
      onChangeFilePath(toValidFilename(step.title));
    }
  }, []);

  const clearConnectionListener = () => {
    $(document).off("mouseup.connectionList");
    $(document).off("mousemove.connectionList");
  };

  React.useEffect(() => {
    clearConnectionListener();
    setupConnectionListener();
    return () => clearConnectionListener();
  }, [step.uuid]);

  const isValidJson = React.useMemo(() => {
    try {
      JSON.parse(editableParameters);
      return true;
    } catch (error) {
      return false;
    }
  }, [editableParameters]);

  return (
    <div className={"detail-subview"}>
      <Stack direction="column" spacing={3}>
        <TextField
          autoFocus
          value={step.title}
          onChange={(e) => onChangeTitle(e.target.value)}
          label="Title"
          disabled={readOnly}
          fullWidth
          ref={refManager.nrefs.titleTextField}
          data-test-id="step-title-textfield"
        />
        {readOnly ? (
          <TextField
            value={step.file_path}
            label="File name"
            disabled={readOnly}
            fullWidth
            margin="normal"
            data-test-id="step-file-name-textfield"
          />
        ) : (
          <ProjectFilePicker
            value={step.file_path}
            pipelineCwd={pipelineCwd}
            onChange={onChangeFilePath}
            menuMaxWidth={menuMaxWidth}
          />
        )}
        {isNotebookStep && (
          <FormControl fullWidth>
            <InputLabel id="kernel-language-label">Kernel language</InputLabel>
            <Select
              label="Kernel language"
              labelId="kernel-language-label"
              id="kernel-language"
              value={step.kernel.name}
              disabled={readOnly}
              onChange={(e) => onChangeKernel(e.target.value)}
            >
              {KERNEL_OPTIONS.map((option) => {
                return (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
        <SelectEnvironment
          value={step.environment}
          disabled={readOnly}
          queryString={
            isNotebookStep
              ? `?language=${kernelNameToLanguage(step.kernel.name)}`
              : ""
          }
          onChange={onChangeEnvironment}
        />
        <Box>
          <Typography
            component="h3"
            variant="subtitle2"
            sx={{ marginBottom: (theme) => theme.spacing(1) }}
          >
            Parameters
          </Typography>
          <CodeMirror
            value={editableParameters}
            options={{
              mode: "application/json",
              theme: "jupyter",
              lineNumbers: true,
              readOnly: readOnly === true, // not sure whether CodeMirror accepts 'falsy' values
            }}
            onBeforeChange={(editor, data, value) => {
              onChangeParameterJSON(value);
            }}
          />
          {!isValidJson && (
            <Alert severity="warning">Your input is not valid JSON.</Alert>
          )}
        </Box>

        {step.incoming_connections.length != 0 && (
          <Box>
            <Typography
              component="h3"
              variant="subtitle2"
              sx={{ marginBottom: (theme) => theme.spacing(1) }}
            >
              Connections
            </Typography>

            <div
              className="connection-list"
              ref={refManager.nrefs.connectionList}
            >
              {step.incoming_connections.map((startNodeUUID: string) => (
                <ConnectionItem
                  title={connections[startNodeUUID].title}
                  filePath={connections[startNodeUUID].file_path}
                  uuid={startNodeUUID}
                  key={startNodeUUID}
                />
              ))}
            </div>
          </Box>
        )}
      </Stack>
    </div>
  );
};
