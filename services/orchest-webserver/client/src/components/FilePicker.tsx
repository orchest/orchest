import { MDCTextFieldReact } from "@orchest/lib-mdc";
import {
  absoluteToRelativePath,
  collapseDoubleDots,
  RefManager,
} from "@orchest/lib-utils";
import * as React from "react";

/**
 * @typedef {{
 *  cwd: any;
 *  icon?: any;
 *  iconTitle?: any;
 *  onChangeValue?: (value: TFilePickerProps['value']) => void;
 *  onCreateFile?: (path: any) => void;
 *  onFocus?: () => void;
 *  tree: any;
 *  value: any;
 * }} TFilePickerProps
 *
 * @type React.FC<TFilePickerProps>
 */

export interface IFilePickerProps {
  cwd: any;
  icon?: any;
  iconTitle?: any;
  onChangeValue?: (value: IFilePickerProps["value"]) => void;
  onCreateFile?: (path: any) => void;
  onFocus?: () => void;
  tree: any;
  value: any;
}

const FilePicker: React.FC<IFilePickerProps> = (props) => {
  const validatePathInTree = (path, tree) => {
    // path assumed to start with /

    // Valid inputs
    // /def/def
    // /def
    // /abc/

    // Invalid inputs:
    // //asd (empty directory component)
    // asd/asd.py (doesn't start with /)
    if (path === undefined || tree === undefined) {
      return false;
    }
    if (tree.type != "directory") {
      return false;
    }
    if (path[0] !== "/") {
      return false;
    }

    let pathComponents = path.split("/");
    let isFirstComponentDir = pathComponents.length > 2;

    if (isFirstComponentDir) {
      for (let x = 0; x < tree.children.length; x++) {
        let child = tree.children[x];
        if (child.name == pathComponents[1] && child.type == "directory") {
          // Path ends in directory
          if (pathComponents[2] == "") {
            return true;
          }
          return validatePathInTree(
            "/" + pathComponents.slice(2).join("/"),
            child
          );
        }
      }
      return false;
    } else {
      for (let x = 0; x < tree.children.length; x++) {
        let child = tree.children[x];
        if (child.name == pathComponents[1] && child.type == "file") {
          return true;
        }
      }
    }
  };

  const computeInitialPath = (props) => {
    let cwd = props.cwd ? props.cwd : "/";
    let fullPath = collapseDoubleDots(cwd + props.value);
    let directoryPath = fullPath.split("/").slice(0, -1).join("/") + "/";

    // check if directoryPath is in tree
    if (!validatePathInTree(directoryPath, props.tree)) {
      directoryPath = "/";
    }

    return directoryPath;
  };

  const [blurTimeout, setBlurTimeout] = React.useState(null);
  const [state, setState] = React.useState({
    focused: false,
    path: computeInitialPath(props),
  });

  const [refManager] = React.useState(new RefManager());

  const directoryListFromNode = (node) => {
    let nodes = [];

    // handle edge case of no nodes
    if (!node.children) {
      return nodes;
    }

    // add create file and move up directory
    nodes.push(
      <li
        key="create"
        className="mdc-deprecated-list-item"
        onClick={onCreateFile}
        data-test-id="file-picker-new-file"
      >
        <i className="material-icons">add</i> New file
      </li>
    );

    if (node.root !== true) {
      nodes.push(
        <li
          key=".."
          className="mdc-deprecated-list-item"
          onClick={onNavigateUp}
        >
          ..
        </li>
      );
    }

    for (let childNode of node.children) {
      nodes.push(
        <li
          key={childNode.name}
          className="mdc-deprecated-list-item"
          onClick={() => onSelectListItem(childNode)}
        >
          {childNode.type == "directory" && (
            <i className="material-icons">folder</i>
          )}
          {childNode.name + (childNode.type == "directory" ? "/" : "")}
        </li>
      );
    }

    return nodes;
  };

  const onCreateFile = () => {
    if (props.onCreateFile) {
      props.onCreateFile(state.path);
    }
  };

  const visualizePath = (path, cwd) => {
    return absoluteToRelativePath(path, cwd).slice(1);
  };

  const onNavigateUp = () => {
    refManager.refs.filePathTextField.focusAtEnd();

    setState((prevState) => {
      let newPath = prevState.path.slice(
        0,
        prevState.path.slice(0, -1).lastIndexOf("/") + 1
      );

      return {
        ...prevState,
        path: newPath,
      };
    });
  };

  const onSelectListItem = (node) => {
    // override focus on list item click
    if (node.type == "directory") {
      refManager.refs.filePathTextField.focusAtEnd();

      setState((prevState) => {
        let newPath = prevState.path + node.name + "/";

        return {
          ...prevState,
          path: newPath,
        };
      });
    } else {
      props.onChangeValue(visualizePath(state.path + node.name, props.cwd));
      setState((prevState) => ({ ...prevState, focused: false }));
    }
  };

  const nodeFromPath = (path, tree) => {
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
  };

  const onBlurMenu = (e) => {
    setState((prevState) => ({ ...prevState, focused: false }));
  };

  const onFocusTextField = (e) => {
    setBlurTimeout(null);
    setState((prevState) => ({ ...prevState, focused: true }));

    if (props.onFocus) {
      props.onFocus();
    }
  };

  const onBlurTextField = (e) => {
    setBlurTimeout(0);
  };

  React.useEffect(() => {
    if (blurTimeout === null) return;

    const manageFileMenuFocus = setTimeout(() => {
      if (document.activeElement !== refManager.refs.fileMenu)
        setState((prevState) => ({ ...prevState, focused: false }));
    }, blurTimeout);

    return () => clearTimeout(manageFileMenuFocus);
  }, [blurTimeout]);

  React.useEffect(() => {
    let propBasedBath = computeInitialPath(props);

    // If the state.path doesn't match prop based path we need to update
    // the value of the FilePicker field to be the directory
    // we navigated to through the change to state.path
    // (to help the user find out their current path by displaying
    // the relative path in the textfield - hence we update the value)
    // that was triggered from within the component.
    // state.path is modified when navigating the directory.
    if (state.path != propBasedBath) {
      props.onChangeValue(visualizePath(state.path, props.cwd));
    }
  }, [state.path]);

  return (
    <div className="dropdown-file-picker">
      <MDCTextFieldReact
        onFocus={onFocusTextField}
        onBlur={onBlurTextField}
        onChange={props.onChangeValue}
        value={props.value}
        label="File path"
        icon={props.icon}
        iconTitle={props.iconTitle}
        ref={refManager.nrefs.filePathTextField}
        classNames={["fullwidth"]}
        data-test-id="file-picker-file-path-textfield"
      />
      <div
        ref={refManager.nrefs.fileMenu}
        onBlur={onBlurMenu}
        // tabIndex is REQUIRED for proper blur/focus events
        // for the dropdown mdc-list.
        tabIndex={0}
        className={
          "mdc-menu mdc-menu-surface mdc-menu-surface--open " +
          (state.focused ? "" : "hidden")
        }
      >
        <ul className="mdc-list">
          {directoryListFromNode(nodeFromPath(state.path, props.tree))}
        </ul>
      </div>
    </div>
  );
};

FilePicker.defaultProps = {
  tree: {
    name: "/",
    root: true,
    type: "directory",
    children: [],
  },
};

export default FilePicker;
