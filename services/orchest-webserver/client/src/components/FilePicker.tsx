import { useClickOutside } from "@/hooks/useClickOutside";
import { FileTree } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import FolderIcon from "@mui/icons-material/Folder";
import TurnLeftOutlinedIcon from "@mui/icons-material/TurnLeftOutlined";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import TextField from "@mui/material/TextField";
import { absoluteToRelativePath, collapseDoubleDots } from "@orchest/lib-utils";
import React from "react";

const validatePathInTree = (path: string, tree: FileTree) => {
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
  if (tree.type !== "directory") {
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

type FilePickerProps = {
  cwd: string;
  icon?: React.ReactNode;
  helperText: string;
  onChangeValue?: (value: FilePickerProps["value"]) => void;
  onCreateFile?: (path: string) => void;
  onFocus?: () => void;
  tree: FileTree;
  value: string;
  menuMaxWidth?: string;
};

const computeInitialPath = ({
  cwd,
  value,
  tree,
}: Pick<FilePickerProps, "cwd" | "value" | "tree">) => {
  let fullPath = collapseDoubleDots(`${!cwd ? "/" : cwd}${value}`);
  let directoryPath = fullPath.split("/").slice(0, -1).join("/") + "/";

  // check if directoryPath is in tree
  if (!validatePathInTree(directoryPath, tree)) {
    directoryPath = "/";
  }

  return directoryPath;
};

const ITEM_HEIGHT = 48;

const FilePicker: React.FC<FilePickerProps> = (props) => {
  const [path, setPath] = React.useState(() => computeInitialPath(props));
  const inputRef = React.useRef<HTMLInputElement>();
  const [anchorEl, setAnchorEl] = React.useState<null | Element>(null);
  const isOpen = Boolean(anchorEl);
  useClickOutside(inputRef, () => setAnchorEl(null));

  const onCreateFile = () => {
    if (props.onCreateFile) {
      props.onCreateFile(path);
    }
  };

  const visualizePath = (path, cwd) => {
    return absoluteToRelativePath(path, cwd).slice(1);
  };

  const onNavigateUp = () => {
    setPath((oldPath) => {
      return oldPath.slice(0, oldPath.slice(0, -1).lastIndexOf("/") + 1);
    });
  };

  const onSelectListItem = (node: FileTree) => {
    if (node.type == "directory") {
      setPath((oldPath) => {
        return `${oldPath}${node.name}/`;
      });
    } else {
      props.onChangeValue(visualizePath(`${path}${node.name}`, props.cwd));
    }
  };

  const onClickTextField = () => {
    setAnchorEl(inputRef.current);
  };

  React.useEffect(() => {
    let propBasedBath = computeInitialPath(props);

    // If the state.path doesn't match prop based path we need to update
    // the value of the FilePicker field to be the directory
    // we navigated to through the change to state.path
    // (to help the user find out their current path by displaying
    // the relative path in the textfield - hence we update the value)
    // that was triggered from within the component.
    // state.path is modified when navigating the directory.
    if (path != propBasedBath) {
      props.onChangeValue(visualizePath(path, props.cwd));
    }
  }, [path]);

  const node = React.useMemo(() => {
    let pathComponents = path.split("/").slice(1);
    let currentNode = props.tree;

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
  }, [path, props.tree]);

  return (
    <div className="dropdown-file-picker">
      <TextField
        onClick={onClickTextField}
        onChange={(e) => props.onChangeValue(e.target.value)}
        value={props.value}
        label="File path"
        fullWidth
        inputRef={inputRef}
        data-test-id="file-picker-file-path-textfield"
        helperText={props.helperText}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">{props.icon}</InputAdornment>
          ),
        }}
      />
      <Menu
        open={isOpen}
        anchorEl={anchorEl}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: props.menuMaxWidth || "24ch",
          },
        }}
      >
        <MenuList dense>
          {node.children && (
            <>
              <MenuItem
                onClick={onCreateFile}
                data-test-id="file-picker-new-file"
              >
                <ListItemIcon>
                  <AddIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>New file</ListItemText>
              </MenuItem>
              {!node.root && (
                <MenuItem onClick={onNavigateUp}>
                  <ListItemIcon>
                    <TurnLeftOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Navigate up</ListItemText>
                </MenuItem>
              )}
              {node.children.map((childNode) => (
                <MenuItem
                  key={childNode.name}
                  onClick={() => onSelectListItem(childNode)}
                >
                  {childNode.type === "directory" && (
                    <ListItemIcon>
                      <FolderIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                  <ListItemText inset={childNode.type !== "directory"}>
                    {`${childNode.name}${
                      childNode.type === "directory" ? "/" : ""
                    }`}
                  </ListItemText>
                </MenuItem>
              ))}
            </>
          )}
        </MenuList>
      </Menu>
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
