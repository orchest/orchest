import * as React from "react";
import {
  MDCButtonReact,
  MDCDialogReact,
  MDCSelectReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  absoluteToRelativePath,
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
import FilePicker from "./FilePicker";

const ProjectFilePicker: React.FC<any> = (props) => {
  const [state, setState] = React.useState({
    createFileModal: false,
    selectedFileExists: null,
    fileName: "",
    selectedExtension: "." + ALLOWED_STEP_EXTENSIONS[0],
    createFileDir: "",
    tree: undefined,
    cwd: null,
  });

  const [refManager] = React.useState(new RefManager());
  const [promiseManager] = React.useState(new PromiseManager());

  const onChangeFileValue = (value) => props.onChange(value);

  const fetchDirectoryDetails = () => {
    // will be populated by async requests
    let tree, cwd;

    let promises = [];

    let treeFetchPromise = makeCancelable(
      makeRequest("GET", `/async/file-picker-tree/${props.project_uuid}`),
      promiseManager
    );
    promises.push(treeFetchPromise.promise);
    treeFetchPromise.promise
      .then((response) => {
        tree = JSON.parse(response);
      })
      .catch((error) => {
        if (!error.isCanceled) {
          console.log(error);
        }
      });

    let cwdFetchPromise = makeCancelable(
      makeRequest(
        "GET",
        `/async/file-picker-tree/pipeline-cwd/${props.project_uuid}/${props.pipeline_uuid}`
      ),
      promiseManager
    );
    promises.push(cwdFetchPromise.promise);

    cwdFetchPromise.promise
      .then((response) => {
        // FilePicker cwd expects trailing / for cwd paths
        cwd = JSON.parse(response)["cwd"] + "/";
      })
      .catch((error) => {
        if (!error.isCanceled) {
          console.log(error);
        }
      });

    Promise.all(promises)
      .then(() => {
        setState((prevState) => ({
          ...prevState,
          tree: tree,
          cwd: cwd,
        }));
      })
      .catch((error) => {
        if (!error.isCanceled) {
          console.error(error);
        }
      });
  };

  const valueValidator = (value) => {
    if (value == "" && value.endsWith("/")) {
      return false;
    }
    let ext = extensionFromFilename(value);
    if (ALLOWED_STEP_EXTENSIONS.indexOf(ext) === -1) {
      return false;
    }
    return true;
  };

  const checkFileValidity = () => {
    // only check file existence if it passes rule based validation
    if (valueValidator(props.value)) {
      let existencePromise = makeCancelable(
        makeRequest(
          "POST",
          `/async/project-files/exists/${props.project_uuid}/${props.pipeline_uuid}`,
          {
            type: "json",
            content: {
              relative_path: props.value,
            },
          }
        ),
        promiseManager
      );

      existencePromise.promise
        .then(() => {
          setState((prevState) => ({
            ...prevState,
            selectedFileExists: true,
          }));
        })
        .catch((e) => {
          if (!e.isCanceled) {
            // rely on 404 behaviour for detecting file existence
            setState((prevState) => ({
              ...prevState,
              selectedFileExists: true,
            }));
          }
        });
    } else {
      // do indicate invalid value for these value
      setState((prevState) => ({
        ...prevState,
        selectedFileExists: false,
      }));
    }
  };

  const onCreateFile = (dir) => {
    let fileNameProposal = "";
    if (props.value) {
      fileNameProposal = props.value
        .split("/")
        .slice(-1)
        .join("/")
        .split(".")[0];
    }

    setState((prevState) => ({
      ...prevState,
      fileName: fileNameProposal,
      createFileDir: dir,
      createFileModal: true,
    }));
  };

  const getFullProjectPath = () =>
    state.createFileDir + state.fileName + state.selectedExtension;

  const onCancelModal = () => refManager.refs.createFileDialog.close();

  const onCloseCreateFileModal = () =>
    setState((prevState) => ({
      ...prevState,
      createFileModal: false,
    }));

  const onChangeNewFilename = (value) =>
    setState((prevState) => ({ ...prevState, fileName: value }));

  const onChangeNewFilenameExtension = (value) =>
    setState((prevState) => ({ ...prevState, selectedExtension: value }));

  const onSubmitModal = () => {
    // validate extensions
    let extension = extensionFromFilename(getFullProjectPath());

    // TODO: case insensitive extension checking?
    if (ALLOWED_STEP_EXTENSIONS.indexOf(extension) == -1) {
      // @ts-ignore
      orchest.alert(
        "Error",
        <div>
          <p>Invalid file extension</p>
          Extension {extension} is not in allowed set of{" "}
          {allowedExtensionsMarkup()}.
        </div>
      );

      return;
    }

    let createPromise = makeCancelable(
      makeRequest(
        "POST",
        `/async/project-files/create/${props.project_uuid}/${props.pipeline_uuid}/${props.step_uuid}`,
        {
          type: "json",
          content: {
            file_path: getFullProjectPath(),
          },
        }
      ),
      promiseManager
    );

    createPromise.promise
      .then(() => {
        onChangeFileValue(
          absoluteToRelativePath(getFullProjectPath(), state.cwd).slice(1)
        );

        setState((prevState) => ({
          ...prevState,
          createFileModal: false,
        }));

        // fetch file tree again with new file in it
        fetchDirectoryDetails();
      })
      .catch((error) => {
        if (error.status == 409) {
          // @ts-ignore
          orchest.alert("Error", "A file with this name already exists.");
        }
        console.log(error);
      });
  };

  const onFocus = () => fetchDirectoryDetails();

  const allowedExtensionsMarkup = () => {
    return ALLOWED_STEP_EXTENSIONS.map((el, index) => {
      return (
        <span key={el}>
          <span className="code">.{el}</span>
          {index < ALLOWED_STEP_EXTENSIONS.length - 1 ? (
            <React.Fragment>&nbsp;, </React.Fragment>
          ) : (
            ""
          )}
        </span>
      );
    });
  };

  React.useEffect(() => {
    fetchDirectoryDetails();
    checkFileValidity();

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => checkFileValidity(), [props.value]);

  return (
    <React.Fragment>
      {state.createFileModal && (
        <MDCDialogReact
          title="Create a new file"
          onClose={onCloseCreateFileModal.bind(this)}
          ref={refManager.nrefs.createFileDialog}
          content={
            <div className="create-file-input">
              <div className="push-down">
                Supported file extensions are:&nbsp;
                {allowedExtensionsMarkup()}.
              </div>

              <div className="push-down field-select-combo">
                <MDCTextFieldReact
                  label="File name"
                  value={state.fileName}
                  onChange={onChangeNewFilename.bind(this)}
                />
                <MDCSelectReact
                  ref={refManager.nrefs.createFileExtensionDropdown}
                  label="Extension"
                  value={state.selectedExtension}
                  options={ALLOWED_STEP_EXTENSIONS.map((el) => ["." + el])}
                  onChange={onChangeNewFilenameExtension.bind(this)}
                />
              </div>
              <MDCTextFieldReact
                label="Path in project"
                value={getFullProjectPath()}
                classNames={["fullwidth push-down"]}
                disabled
              />
            </div>
          }
          actions={
            <React.Fragment>
              <MDCButtonReact
                icon="close"
                label="Cancel"
                classNames={["push-right"]}
                onClick={onCancelModal.bind(this)}
              />
              <MDCButtonReact
                icon="add"
                classNames={["mdc-button--raised", "themed-secondary"]}
                label="Create file"
                submitButton
                onClick={onSubmitModal.bind(this)}
              />
            </React.Fragment>
          }
        />
      )}
      {state.cwd && state.tree && (
        <FilePicker
          // @ts-ignore
          ref={refManager.nrefs.filePicker}
          tree={state.tree}
          cwd={state.cwd}
          onFocus={onFocus.bind(this)}
          value={props.value}
          icon={state.selectedFileExists ? "check" : "warning"}
          iconTitle={
            state.selectedFileExists
              ? "File exists in the project directory."
              : "Warning: this file wasn't found in the project directory."
          }
          onCreateFile={onCreateFile.bind(this)}
          onChangeValue={onChangeFileValue.bind(this)}
        />
      )}
    </React.Fragment>
  );
};

export default ProjectFilePicker;
