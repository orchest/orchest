import React from "react";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import { absoluteToRelativePath, RefManager } from "../lib/utils/all";

class FilePicker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      focused: false,
      path: props.cwd ? props.cwd : "/",
    };

    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    clearTimeout(this.blurTimeout);
  }

  onChangeValue(value) {
    if (this.props.onChangeValue) {
      this.props.onChangeValue(value);
    }
  }

  directoryListFromNode(node) {
    let nodes = [];

    // handle edge case of no nodes
    if (!node.children) {
      return nodes;
    }

    // add create file and move up directory
    nodes.push(
      <li
        key="create"
        className="mdc-list-item"
        onClick={this.onCreateFile.bind(this)}
      >
        <i className="material-icons">add</i> New file
      </li>
    );

    if (node.root !== true) {
      nodes.push(
        <li
          key=".."
          className="mdc-list-item"
          onClick={this.onNavigateUp.bind(this)}
        >
          ..
        </li>
      );
    }

    for (let childNode of node.children) {
      nodes.push(
        <li
          key={childNode.name}
          className="mdc-list-item"
          onClick={this.onSelectListItem.bind(this, childNode)}
        >
          {childNode.type == "directory" && (
            <i className="material-icons">folder</i>
          )}
          {childNode.name + (childNode.type == "directory" ? "/" : "")}
        </li>
      );
    }

    return nodes;
  }

  onCreateFile() {
    if (this.props.onCreateFile) {
      this.props.onCreateFile(this.state.path);
    }
  }

  visualizePath(path, cwd) {
    return absoluteToRelativePath(path, cwd).slice(1);
  }

  onNavigateUp() {
    this.refManager.refs.filePathTextField.focusAtEnd();

    this.setState((state, _) => {
      let newPath = state.path.slice(
        0,
        state.path.slice(0, -1).lastIndexOf("/") + 1
      );

      this.onChangeValue(this.visualizePath(newPath, this.props.cwd));

      return {
        path: newPath,
      };
    });
  }

  onSelectListItem(node) {
    // override focus on list item click
    if (node.type == "directory") {
      this.refManager.refs.filePathTextField.focusAtEnd();

      this.setState((state, _) => {
        let newPath = state.path + node.name + "/";

        this.onChangeValue(this.visualizePath(newPath, this.props.cwd));

        return {
          path: newPath,
        };
      });
    } else {
      this.onChangeValue(
        this.visualizePath(this.state.path + node.name, this.props.cwd)
      );

      this.setState({
        focused: false,
      });
    }
  }

  nodeFromPath(path, tree) {
    // a path should always start with a root of "/"
    let pathComponents = path.split("/").slice(1);
    let currentNode = tree;

    // traverse to the right directory node
    for (let component of pathComponents) {
      for (let child of currentNode.children) {
        if (child.name == component) {
          currentNode = child;
          break;
        }
      }
    }

    return currentNode;
  }

  onBlurMenu(e) {
    this.setState({
      focused: false,
    });
  }

  onFocusTextField(e) {
    this.setState({
      focused: true,
    });
    if (this.props.onFocus) {
      this.props.onFocus();
    }
  }

  onBlurTextField(e) {
    clearTimeout(this.blurTimeout);
    this.blurTimeout = setTimeout(() => {
      if (document.activeElement !== this.refManager.refs.fileMenu) {
        this.setState({
          focused: false,
        });
      }
    });
  }

  render() {
    let directory_list = this.directoryListFromNode(
      this.nodeFromPath(this.state.path, this.props.tree)
    );

    return (
      <div className="dropdown-file-picker">
        <MDCTextFieldReact
          onFocus={this.onFocusTextField.bind(this)}
          onBlur={this.onBlurTextField.bind(this)}
          onChange={this.onChangeValue.bind(this)}
          value={this.props.value}
          label="File path"
          icon={this.props.icon}
          iconTitle={this.props.iconTitle}
          ref={this.refManager.nrefs.filePathTextField}
          classNames={["fullwidth"]}
        />
        {(() => {
          return (
            <div
              ref={this.refManager.nrefs.fileMenu}
              onBlur={this.onBlurMenu.bind(this)}
              // tabIndex is REQUIRED for proper blur/focus events
              // for the dropdown mdc-list.
              tabIndex="0"
              className={
                "mdc-menu mdc-menu-surface mdc-menu-surface--open " +
                (this.state.focused ? "" : "hidden")
              }
            >
              <ul className="mdc-list">{directory_list}</ul>
            </div>
          );
        })()}
      </div>
    );
  }
}

FilePicker.defaultProps = {
  tree: {
    name: "/",
    root: true,
    type: "directory",
    children: [],
  },
};

export default FilePicker;
