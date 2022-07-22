import ProjectFilePicker from "@/components/ProjectFilePicker";
import { Step } from "@/types";
import { firstAncestor } from "@/utils/element";
import { hasExtension, join } from "@/utils/path";
import { toValidFilename } from "@/utils/toValidFilename";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  ALLOWED_STEP_EXTENSIONS,
  kernelNameToLanguage,
  RefManager,
} from "@orchest/lib-utils";
import cloneDeep from "lodash.clonedeep";
import React from "react";
import { SelectEnvironment } from "./SelectEnvironment";
import { useStepDetailsContext } from "./StepDetailsContext";
import { StepParameters } from "./StepParameters";

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
  shouldAutoFocus,
  onSave,
  menuMaxWidth,
}: {
  pipelineCwd: string | undefined;
  readOnly: boolean;
  shouldAutoFocus: boolean;
  onSave: (payload: Partial<Step>, uuid: string, replace?: boolean) => void;
  menuMaxWidth?: string;
}) => {
  const {
    step,
    connections,
    doesStepFileExist,
    isCheckingFileValidity,
  } = useStepDetailsContext();

  const refManager = React.useMemo(() => new RefManager(), []);

  const isNotebookStep = hasExtension(step.file_path, "ipynb");

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
            join(pipelineCwd, step.file_path),
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
    if (!refManager.refs.connectionList) return;

    let previousPosition = 0;
    let connectionItemOffset = 0;
    let oldConnectionIndex = 0;
    let newConnectionIndex = 0;

    const connectionItems = [
      ...refManager.refs.connectionList.querySelectorAll(".connection-item"),
    ];

    let numConnectionListItems = connectionItems.length;

    const mouseDown = (event: MouseEvent) => {
      const item = firstAncestor(event.target as HTMLElement, (element) =>
        element.classList.contains("connection-item")
      );

      if (!item) return;

      previousPosition = event.clientY;
      connectionItemOffset = 0;

      refManager.refs.connectionList.classList.add("dragging");
      oldConnectionIndex =
        [...(item.parentNode?.children || [])].findIndex(
          (node) => node === item
        ) || 0;

      item.classList.add("selected");
    };

    const mouseMove = (event: MouseEvent) => {
      const selectedConnection = refManager.refs.connectionList.querySelector(
        ".connection-item.selected"
      );

      if (selectedConnection) {
        const clientY = event.clientY as number;
        const positionDelta = clientY - previousPosition;

        previousPosition = clientY;

        const itemHeight = selectedConnection.clientHeight;

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

        selectedConnection.style.transform = `translateY(${connectionItemOffset}px)`;

        // find new index based on current position
        const elementYPosition =
          (oldConnectionIndex * itemHeight + connectionItemOffset) / itemHeight;

        newConnectionIndex = Math.min(
          Math.max(0, Math.round(elementYPosition)),
          numConnectionListItems - 1
        );

        refManager.refs.connectionList
          .querySelectorAll(".connection-item")
          .forEach((conn: HTMLElement, index: number) => {
            conn.classList.remove("swapped-up");
            conn.classList.remove("swapped-down");

            if (newConnectionIndex >= index && index > oldConnectionIndex) {
              conn.classList.add("swapped-up");
            } else if (
              newConnectionIndex <= index &&
              index < oldConnectionIndex
            ) {
              conn.classList.add("swapped-down");
            }
          });
      }
    };

    const mouseUp = () => {
      const selectedConnection = refManager.refs.connectionList.querySelector(
        ".connection-item.selected"
      );

      if (selectedConnection) {
        selectedConnection.style.transform = "";
        selectedConnection.classList.remove("selected");

        refManager.refs.connectionList
          .querySelectorAll(".connection-item")
          .forEach((conn: HTMLElement) => {
            conn.classList.remove("swapped-up");
            conn.classList.remove("swapped-down");
          });

        refManager.refs.connectionList.classList.remove("dragging");

        swapConnectionOrder(oldConnectionIndex, newConnectionIndex);
      }
    };

    refManager.refs.connectionList.addEventListener("mousemove", mouseMove);
    refManager.refs.connectionList.addEventListener("mouseup", mouseUp);
    connectionItems.forEach((item) =>
      item.addEventListener("mousedown", mouseDown)
    );

    return () => {
      refManager.refs.connectionList?.removeEventListener(
        "mousemove",
        mouseMove
      );
      refManager.refs.connectionList?.removeEventListener("mouseup", mouseUp);

      connectionItems.forEach((item) =>
        item.removeEventListener("mousedown", mouseDown)
      );
    };
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

  React.useEffect(setupConnectionListener, [step.uuid]);

  return (
    <div className={"detail-subview"}>
      <Stack direction="column" spacing={3}>
        <TextField
          autoFocus={shouldAutoFocus}
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
            allowedExtensions={ALLOWED_STEP_EXTENSIONS}
            pipelineCwd={pipelineCwd}
            onChange={onChangeFilePath}
            menuMaxWidth={menuMaxWidth}
            doesFileExist={doesStepFileExist}
            isCheckingFileValidity={isCheckingFileValidity}
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
        <StepParameters isReadOnly={readOnly} onSave={onSave} />
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
