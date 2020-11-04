import React, { Fragment } from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import { RefManager } from "../lib/utils/all";
import FilePicker from "./FilePicker";

class ProjectFilePicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      createFileModal: false,
      tree: {
        type: "directory",
        name: "/",
        root: true,
        children: [
          {
            type: "directory",
            name: "images",
            children: [
              {
                type: "directory",
                name: "animations",
                children: [
                  {
                    type: "file",
                    name: "dogs.gif",
                  },
                ]
              },
              {
                type: "file",
                name: "image.png",
              },
            ]
          },
          {
            type: "file",
            name: "test.txt",
          },
        ],
      }
    }

    this.refManager = new RefManager();

  }

  componentDidMount() {
  }

  onCreateFile(cwd) {
    this.setState({
      createFileFullProjectPath: cwd,
      createFileCWD: cwd,
      createFileModal: true
    })
  }

  onCancelModal() {
    this.setState({
      createFileModal: false
    })
  }

  onChangeNewFilename(value) {
    this.setState((state, _) => {
      return {
        createFileFullProjectPath: state.createFileCWD + value
      }
    })
  }

  onSubmitModal(){
    
  }

  render() {

    return (
      <Fragment>
        {(() => {
          if (this.state.createFileModal) {
            return <MDCDialogReact
              title="Create a new file"
              content={
                <Fragment>
                  <p className="push-down">Supported file extensions are:&nbsp;
                      <span className="code">.ipynb</span>,&nbsp;
                      <span className="code">.py</span>,&nbsp;
                      <span className="code">.R</span>, and&nbsp;
                      <span className="code">.sh</span>.</p>

                  <MDCTextFieldReact
                    ref={this.refManager.nrefs.createFileTextField}
                    classNames={["fullwidth push-down"]}
                    label="File name"
                    onChange={this.onChangeNewFilename.bind(this)}
                  />
                  <MDCTextFieldReact
                    label="Path in project"
                    value={this.state.createFileFullProjectPath}
                    classNames={["fullwidth push-down"]}
                    ref={this.refManager.nrefs.fullFilePath}
                    disabled
                  />
                </Fragment>
              }
              actions={
                <Fragment>
                  <MDCButtonReact
                    icon="add"
                    classNames={["mdc-button--raised", "themed-secondary"]}
                    label="Create file"
                    onClick={this.onSubmitModal.bind(this)}
                  />
                  <MDCButtonReact
                    icon="close"
                    label="Cancel"
                    classNames={["push-left"]}
                    onClick={this.onCancelModal.bind(this)}
                  />
                </Fragment>
              }
            />
          }
        })()}
        <FilePicker tree={this.state.tree} cwd="/images/" onCreateFile={this.onCreateFile.bind(this)} />
      </Fragment>
    );
  }
}

export default ProjectFilePicker;
