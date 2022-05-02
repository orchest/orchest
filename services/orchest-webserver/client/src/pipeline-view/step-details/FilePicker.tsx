import { useClickOutside } from "@/hooks/useClickOutside";
import { FileTree } from "@/types";
import FolderIcon from "@mui/icons-material/Folder";
import TurnLeftOutlinedIcon from "@mui/icons-material/TurnLeftOutlined";
import Box from "@mui/material/Box";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import {
  ALLOWED_STEP_EXTENSIONS,
  collapseDoubleDots,
  extensionFromFilename,
} from "@orchest/lib-utils";
import React from "react";
import { getFilePathForRelativeToProject } from "../file-manager/common";

const validatePathInTree = (path: string, tree: FileTree) => {
  // path assumed to start with /

  /**
   * Valid inputs:
   * "/def/def"
   * "/def"
   * "/abc/"
   *
   * Invalid inputs:
   * "//asd" (empty directory component)
   * "asd/asd.py" (missing the leading slash)
   */

  if (path === undefined || tree === undefined) {
    return false;
  }

  if (path === "") return true; // the path represents the root of the tree

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
  onChangeValue: (value: FilePickerProps["value"]) => void;
  tree: FileTree;
  value: string;
  menuMaxWidth?: string;
  onSelectMenuItem: (node: FileTree) => void;
};

const getFolderPath = (filePath: string) =>
  filePath.split("/").slice(0, -1).join("/") + "/";

const computeAbsPath = ({
  cwd,
  value,
  tree,
}: Pick<FilePickerProps, "cwd" | "value" | "tree">) => {
  // The path for /data/ folder is absolute
  if (value.startsWith("/data/")) {
    return getFolderPath(value.replace(/^\/data\//, "/data:/"));
  }

  const absCwd = `/project-dir:/${cwd === "/" ? "" : cwd}`;

  // The rest is a relative path to pipelineCwd
  const projectFilePath = collapseDoubleDots(`${absCwd}${value}`);
  const isFile = !projectFilePath.endsWith("/");
  const directoryPath = isFile
    ? getFolderPath(projectFilePath)
    : projectFilePath;

  // Check if directoryPath exists.
  // If not, use pipelineCwd as fallback.
  return !validatePathInTree(directoryPath, tree) ? absCwd : directoryPath;
};

const ITEM_HEIGHT = 48;

// TODO: use MUI Dropdown when it is released

const FilePicker: React.FC<FilePickerProps> = ({
  cwd,
  value,
  tree,
  onChangeValue,
  helperText,
  icon,
  menuMaxWidth,
  onSelectMenuItem,
}) => {
  const computedAbsPath = React.useMemo(() => {
    return computeAbsPath({ cwd, value, tree });
  }, [cwd, value, tree]);

  const [absPath, setAbsPath] = React.useState<string>(computedAbsPath);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>();
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  useClickOutside(menuRef, () => setIsDropdownOpen(false));

  const isBlurAllowed = React.useRef(true);
  const onMouseOverMenu = () => {
    isBlurAllowed.current = false;
  };
  const onMouseLeaveMenu = () => {
    isBlurAllowed.current = true;
  };

  const onNavigateUp = () => {
    setAbsPath((oldPath) => {
      return oldPath.slice(0, oldPath.slice(0, -1).lastIndexOf("/") + 1);
    });
  };

  const onFocusTextField = () => {
    setIsDropdownOpen(true);
  };

  const onBlurTextField = () => {
    if (isBlurAllowed.current) setIsDropdownOpen(false);
  };

  React.useEffect(() => {
    // If the state.path doesn't match computedAbsPath, we need to update
    // the value of the FilePicker field to be the directory
    // we navigated to through the change to state.path.
    // (to help the user find out their current path by displaying
    // the relative path in the textfield - hence we update the value)
    // that was triggered from within the component.
    // state.path is modified when navigating the directory.
    if (absPath !== computedAbsPath) {
      onChangeValue(getFilePathForRelativeToProject(absPath, cwd));
    }
  }, [absPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isRootNode, options } = React.useMemo(() => {
    // Absolute paths always start and end with a forward slash.
    let pathComponents = absPath.slice(1, -1).split("/");
    let currentNode = tree;

    // traverse to the right directory node
    for (let component of pathComponents) {
      for (let child of currentNode.children) {
        // Root nodes need to be handled differently.
        // Because `node.name` is used to render UI, we have to check node.path, which ends with ":/".
        // For the rest of the nodes, simply compare node.name.
        const isRoot =
          child.depth === 0 && /^\/(.*):\/$/.test(child.path || "");
        const valueToCompare = isRoot
          ? (child.path || "").replace(/\//g, "")
          : child.name;

        if (valueToCompare === component) {
          currentNode = child;
          break;
        }
      }
    }

    return {
      isRootNode: currentNode.root,
      options: currentNode.children.filter((childNode) => {
        return (
          childNode.type === "directory" ||
          ALLOWED_STEP_EXTENSIONS.includes(
            extensionFromFilename(childNode.name)
          )
        );
      }),
    };
  }, [absPath, tree]);

  const onSelectListItem = (selectedNode: FileTree) => {
    onSelectMenuItem(selectedNode);
    if (selectedNode.type === "directory") {
      setAbsPath((oldPath) => {
        const selectedNodePath = selectedNode.path || "";
        // If it's root, it needs to be handled differently.
        // It is either "/project-dir:/", or "/data:/".
        if (["/project-dir:/", "/data:/"].includes(selectedNodePath))
          return selectedNodePath;

        return `${oldPath}${selectedNode.name}/`;
      });
    } else {
      onChangeValue(
        getFilePathForRelativeToProject(`${absPath}${selectedNode.name}`, cwd)
      );
      setIsDropdownOpen(false);
    }
  };

  return (
    <Box sx={{ position: "relative" }}>
      <TextField
        inputRef={inputRef}
        onFocusCapture={onFocusTextField}
        onBlur={onBlurTextField}
        onChange={(e) => onChangeValue(e.target.value)}
        value={value}
        label="File path"
        fullWidth
        data-test-id="file-picker-file-path-textfield"
        helperText={helperText || " "}
        InputProps={{
          endAdornment: <InputAdornment position="end">{icon}</InputAdornment>,
        }}
      />
      {isDropdownOpen && (
        <Paper
          ref={menuRef}
          elevation={4}
          onMouseOver={onMouseOverMenu}
          onMouseLeave={onMouseLeaveMenu}
          sx={{
            maxHeight: ITEM_HEIGHT * 4.5,
            overflowY: "auto",
            width: menuMaxWidth || "24ch",
            position: "absolute",
            top: (theme) => theme.spacing(7),
            zIndex: 10,
          }}
        >
          <MenuList dense>
            {options && (
              <>
                {!isRootNode && (
                  <MenuItem onClick={onNavigateUp}>
                    <ListItemIcon>
                      <TurnLeftOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Navigate up</ListItemText>
                  </MenuItem>
                )}
                {options.map((childNode) => {
                  const nodeName = childNode.name;
                  return (
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
                        {`${nodeName}${
                          childNode.type === "directory" ? "/" : ""
                        }`}
                      </ListItemText>
                    </MenuItem>
                  );
                })}
              </>
            )}
          </MenuList>
        </Paper>
      )}
    </Box>
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
