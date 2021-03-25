import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import {
  absoluteToRelativePath,
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "../lib/utils/all";
import FilePicker from "./FilePicker";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";

class ProjectFilePicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      createFileModal: false,
      selectedFileExists: "undetermined",
      fileName: "",
      selectedExtension: "." + ALLOWED_STEP_EXTENSIONS[0],
      createFileDir: "",
      tree: undefined,
    };

    this.refManager = new RefManager();
    this.promiseManager = new PromiseManager();
  }

  componentDidMount() {
    this.fetchDirectoryDetails();
    this.checkFileValidity();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value != this.props.value) {
      this.checkFileValidity();
    }
  }

  onChangeFileValue(value) {
    this.props.onChange(value);
  }

  fetchDirectoryDetails() {
    // will be populated by async requests
    let tree, cwd;

    let promises = [];

    let treeFetchPromise = makeCancelable(
      makeRequest("GET", `/async/file-picker-tree/${this.props.project_uuid}`),
      this.promiseManager
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
        `/async/file-picker-tree/pipeline-cwd/${this.props.project_uuid}/${this.props.pipeline_uuid}`
      ),
      this.promiseManager
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
        this.setState({
          tree: tree,
          cwd: cwd,
        });
      })
      .catch((error) => {
        if (!error.isCanceled) {
          console.error(error);
        }
      });
  }

  valueValidator(value) {
    if (value == "" && value.endsWith("/")) {
      return false;
    }
    let ext = extensionFromFilename(value);
    if (ALLOWED_STEP_EXTENSIONS.indexOf(ext) === -1) {
      return false;
    }
    return true;
  }

  checkFileValidity() {
    // only check file existence if it passes rule based validation
    if (this.valueValidator(this.props.value)) {
      let existencePromise = makeCancelable(
        makeRequest(
          "POST",
          `/async/project-files/exists/${this.props.project_uuid}/${this.props.pipeline_uuid}`,
          {
            type: "json",
            content: {
              relative_path: this.props.value,
            },
          }
        ),
        this.promiseManager
      );

      existencePromise.promise
        .then(() => {
          this.setState({
            selectedFileExists: true,
          });
        })
        .catch((e) => {
          if (!e.isCanceled) {
            // rely on 404 behaviour for detecting file existence
            this.setState({
              selectedFileExists: false,
            });
          }
        });
    } else {
      // do indicate invalid value for these value
      this.setState({
        selectedFileExists: false,
      });
    }
  }

  onCreateFile(dir) {
    let fileNameProposal = "";
    if (this.props.value) {
      fileNameProposal = this.props.value
        .split("/")
        .slice(-1)
        .join("/")
        .split(".")[0];
    }

    this.setState({
      fileName: fileNameProposal,
      createFileDir: dir,
      createFileModal: true,
    });
  }

  getFullProjectPath() {
    return (
      this.state.createFileDir +
      this.state.fileName +
      this.state.selectedExtension
    );
  }

  onCancelModal() {
    this.refManager.refs.createFileDialog.close();
  }

  onCloseCreateFileModal() {
    this.setState({
      createFileModal: false,
    });
  }

  onChangeNewFilename(value) {
    this.setState((state, _) => {
      return {
        fileName: value,
      };
    });
  }

  onChangeNewFilenameExtension(value) {
    this.setState((state, _) => {
      return {
        selectedExtension: value,
      };
    });
  }

  onSubmitModal() {
    // validate extensions
    let extension = extensionFromFilename(this.getFullProjectPath());

    // TODO: case insensitive extension checking?
    if (ALLOWED_STEP_EXTENSIONS.indexOf(extension) == -1) {
      orchest.alert(
        "Error",
        <div>
          <p>Invalid file extension</p>
          Extension {extension} is not in allowed set of{" "}
          {this.allowedExtensionsMarkup()}.
        </div>
      );

      return;
    }

    let createPromise = makeCancelable(
      makeRequest(
        "POST",
        `/async/project-files/create/${this.props.project_uuid}/${this.props.pipeline_uuid}/${this.props.step_uuid}`,
        {
          type: "json",
          content: {
            file_path: this.getFullProjectPath(),
          },
        }
      ),
      this.promiseManager
    );

    createPromise.promise
      .then(() => {
        this.onChangeFileValue(
          absoluteToRelativePath(
            this.getFullProjectPath(),
            this.state.cwd
          ).slice(1)
        );

        this.setState({
          createFileModal: false,
        });

        // fetch file tree again with new file in it
        this.fetchDirectoryDetails();
      })
      .catch((error) => {
        if (error.status == 409) {
          orchest.alert("Error", "A file with this name already exists.");
        }
        console.log(error);
      });
  }

  onFocus() {
    // fetch on focus
    this.fetchDirectoryDetails();
  }

  allowedExtensionsMarkup() {
    return ALLOWED_STEP_EXTENSIONS.map((el, index) => {
      return (
        <span key={el}>
          <span className="code">.{el}</span>
          {index < ALLOWED_STEP_EXTENSIONS.length - 1 ? (
            <Fragment>&nbsp;, </Fragment>
          ) : (
            ""
          )}
        </span>
      );
    });
  }

  render() {
    return (
      <Fragment>
        {(() => {
          if (this.state.createFileModal) {
            return (
              <MDCDialogReact
                title="Create a new file"
                onClose={this.onCloseCreateFileModal.bind(this)}
                ref={this.refManager.nrefs.createFileDialog}
                content={
                  <div className="create-file-input">
                    <div className="push-down">
                      Supported file extensions are:&nbsp;
                      {this.allowedExtensionsMarkup()}.
                    </div>

                    <div className="push-down field-select-combo">
                      <MDCTextFieldReact
                        label="File name"
                        value={this.state.fileName}
                        onChange={this.onChangeNewFilename.bind(this)}
                      />
                      <MDCSelectReact
                        ref={this.refManager.nrefs.createFileExtensionDropdown}
                        label="Extension"
                        value={this.state.selectedExtension}
                        options={ALLOWED_STEP_EXTENSIONS.map((el) => [
                          "." + el,
                        ])}
                        onChange={this.onChangeNewFilenameExtension.bind(this)}
                      />
                    </div>
                    <MDCTextFieldReact
                      label="Path in project"
                      value={this.getFullProjectPath()}
                      classNames={["fullwidth push-down"]}
                      ref={this.refManager.nrefs.fullFilePath}
                      disabled
                    />
                  </div>
                }
                actions={
                  <Fragment>
                    <MDCButtonReact
                      icon="close"
                      label="Cancel"
                      classNames={["push-right"]}
                      onClick={this.onCancelModal.bind(this)}
                    />
                    <MDCButtonReact
                      icon="add"
                      classNames={["mdc-button--raised", "themed-secondary"]}
                      label="Create file"
                      submitButton
                      onClick={this.onSubmitModal.bind(this)}
                    />
                  </Fragment>
                }
              />
            );
          }
        })()}
        {this.state.cwd && this.state.tree && (
          <FilePicker
            ref={this.refManager.nrefs.filePicker}
            tree={this.state.tree}
            cwd={this.state.cwd}
            onFocus={this.onFocus.bind(this)}
            value={this.props.value}
            icon={this.state.selectedFileExists ? "check" : "warning"}
            iconTitle={
              this.state.selectedFileExists
                ? "File exists in the project directory."
                : "Warning: this file wasn't found in the project directory."
            }
            onCreateFile={this.onCreateFile.bind(this)}
            onChangeValue={this.onChangeFileValue.bind(this)}
          />
        )}
      </Fragment>
    );
  }
}

export default ProjectFilePicker;
