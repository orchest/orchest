import { useHasChanged } from "@/hooks/useHasChanged";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { FileTree } from "@/types";
import { hasExtension, join } from "@/utils/path";
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
import React from "react";

export const validatePathInTree = (path: string, tree: FileTree) => {
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

  // `path` represents the root of the tree
  if (path === "") return true;

  // Should always be absolute.
  if (!path.startsWith("/")) return false;

  let pathComponents = path.split("/");

  let isFirstComponentDir = pathComponents.length > 2;

  // `path` contains double slashes.
  if (isFirstComponentDir && pathComponents[1] === "") return false;

  if (isFirstComponentDir) {
    for (let x = 0; x < tree.children.length; x++) {
      let child = tree.children[x];

      // Normally, `name` should be `path` without leading and trailing slashes,
      // but sometimes `name` and `path` are not aligned for UI rendering purposes,
      const matchingPathComponent =
        child.name === pathComponents[1] ||
        child.path?.replace(/^\//, "").replace(/\/$/, "") === pathComponents[1];

      if (matchingPathComponent && child.type === "directory") {
        // Path ends in directory
        if (pathComponents[2] === "") return true;

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

export type FilePickerProps = {
  cwd: string;
  absoluteCwd: string;
  icon?: React.ReactNode;
  helperText: string;
  onChangeValue: (value: FilePickerProps["value"]) => void;
  tree: FileTree;
  value: string;
  onSelectMenuItem: (node: FileTree) => void;
  allowedExtensions: readonly string[];
  generateRelativePath: (absoluteFolderPath: string, cwd: string) => string;
};

const ITEM_HEIGHT = 48;

const useFilePicker = ({
  cwd,
  tree,
  absoluteCwd,
  onChangeValue,
  allowedExtensions,
  generateRelativePath,
}: Pick<
  FilePickerProps,
  "absoluteCwd" | "cwd" | "tree" | "onChangeValue" | "allowedExtensions"
> & {
  generateRelativePath: (absoluteFolderPath: string, cwd: string) => string;
}) => {
  const generateRelativePathRef = React.useRef(generateRelativePath);
  const onChangeValueRef = React.useRef(onChangeValue);

  const [absoluteFolderPath, setAbsoluteFolderPath] = React.useState<string>(
    absoluteCwd
  );
  const onNavigateUp = () => {
    setAbsoluteFolderPath((oldPath) => {
      const newPath = oldPath.slice(
        0,
        oldPath.slice(0, -1).lastIndexOf("/") + 1
      );

      return newPath === "/" ? "" : newPath;
    });
  };

  React.useEffect(() => {
    // If absoluteFolderPath doesn't match absoluteCwd, we need to update
    // the value of the FilePicker field to be the directory user is viewing via the dropdown.
    // as a visual feedback.
    if (absoluteFolderPath !== absoluteCwd) {
      onChangeValueRef.current(
        generateRelativePathRef.current(absoluteFolderPath, cwd)
      );
    }
  }, [absoluteFolderPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isRootNode, options } = React.useMemo(() => {
    // Absolute paths always start and end with a forward slash.
    let pathComponents = absoluteFolderPath.slice(1, -1).split("/");
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
          hasExtension(childNode.name, ...allowedExtensions)
        );
      }),
    };
  }, [absoluteFolderPath, tree, allowedExtensions]);

  return {
    absoluteFolderPath,
    setAbsoluteFolderPath,
    onNavigateUp,
    isRootNode,
    options,
  };
};

// TODO: use MUI Dropdown when it is released

const FilePicker: React.FC<FilePickerProps> = ({
  cwd,
  absoluteCwd, // Because the file tree could have multiple roots, e.g. /project-dir:/ or /data:/.
  value,
  tree,
  onChangeValue,
  helperText,
  icon,
  onSelectMenuItem,
  generateRelativePath,
  allowedExtensions,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>();
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuFirstItemRef = React.useRef<HTMLLIElement | null>(null);
  useOnClickOutside(menuRef, () => setIsDropdownOpen(false));

  const {
    absoluteFolderPath,
    setAbsoluteFolderPath,
    onNavigateUp,
    isRootNode,
    options,
  } = useFilePicker({
    cwd,
    absoluteCwd,
    tree,
    onChangeValue,
    allowedExtensions,
    generateRelativePath,
  });

  // When clicking on the dropdown menu, the built-in `onBlur` will be fired.
  // Use a boolean to control if it's an intended blur behavior.
  const isBlurAllowed = React.useRef(true);
  const onMouseOverMenu = () => {
    isBlurAllowed.current = false;
  };
  const onMouseLeaveMenu = () => {
    isBlurAllowed.current = true;
  };

  const onFocusTextField = () => {
    setIsDropdownOpen(true);
  };

  const onBlurTextField = () => {
    if (isBlurAllowed.current) {
      setIsDropdownOpen(false);
    }
  };

  const onSelectListItem = (e: React.MouseEvent, selectedNode: FileTree) => {
    onSelectMenuItem(selectedNode);
    if (selectedNode.type === "directory") {
      setAbsoluteFolderPath((oldPath) => {
        const selectedNodePath = selectedNode.path || "";
        // If it's root, it needs to be handled differently.
        // It is either "/project-dir:/", or "/data:/".
        if (["/project-dir:/", "/data:/"].includes(selectedNodePath))
          return selectedNodePath;

        return join(oldPath, selectedNode.name + "/");
      });
    } else {
      e.preventDefault(); // To prevent trigger `onFocusTextField`.
      onChangeValue(
        generateRelativePath(`${absoluteFolderPath}${selectedNode.name}`, cwd)
      );
      inputRef.current?.focus();
      setIsDropdownOpen(false);
    }
  };

  const onTextFieldKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      isBlurAllowed.current = false;
      menuFirstItemRef.current?.focus();
      if (!isDropdownOpen) setIsDropdownOpen(true);
    }
  };

  const hasOptionChanged = useHasChanged(options);
  React.useEffect(() => {
    if (hasOptionChanged && isDropdownOpen) {
      isBlurAllowed.current = false;
      menuFirstItemRef.current?.focus();
    }
  }, [hasOptionChanged, isDropdownOpen]);

  const onClick = () => {
    if (!isDropdownOpen && inputRef.current === document.activeElement)
      setIsDropdownOpen(true);
  };

  React.useEffect(() => {
    // Applying the logic to onKeyUp for `MenuItem` is prone to error.
    // The DOM ref is not always valid because the DOM element constantly being updated.
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isDropdownOpen) {
        event.preventDefault();
        inputRef.current?.focus();
        setIsDropdownOpen(false);
      }
      if (
        event.key === "Enter" &&
        isDropdownOpen &&
        menuFirstItemRef.current !== document.activeElement
      ) {
        // Some other MUI might aggressively grab the focus.
        // As long as pressing Enter when Dropdown is open, force focusing the first menu element.
        event.preventDefault();
        menuFirstItemRef.current?.focus();
      }
    };

    document.addEventListener("keydown", keyDownHandler);

    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  }, [isDropdownOpen]);

  return (
    <Box sx={{ position: "relative" }}>
      <TextField
        inputRef={inputRef}
        onClick={onClick}
        onFocusCapture={onFocusTextField}
        onBlur={onBlurTextField}
        onChange={(e) => onChangeValue(e.target.value)}
        onKeyUp={onTextFieldKeyUp}
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
            position: "absolute",
            top: (theme) => theme.spacing(7),
            zIndex: 10,
          }}
        >
          <MenuList dense>
            {options && !isRootNode && (
              <MenuItem onClick={onNavigateUp} ref={menuFirstItemRef}>
                <ListItemIcon>
                  <TurnLeftOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Navigate up</ListItemText>
              </MenuItem>
            )}
            {options?.map((childNode, index) => {
              const nodeName = childNode.name;
              return (
                <MenuItem
                  key={childNode.name}
                  onClick={(e) => onSelectListItem(e, childNode)}
                  ref={isRootNode && index === 0 ? menuFirstItemRef : undefined}
                >
                  {childNode.type === "directory" && (
                    <ListItemIcon>
                      <FolderIcon fontSize="small" />
                    </ListItemIcon>
                  )}
                  <ListItemText inset={childNode.type !== "directory"}>
                    {`${nodeName}${childNode.type === "directory" ? "/" : ""}`}
                  </ListItemText>
                </MenuItem>
              );
            })}
          </MenuList>
        </Paper>
      )}
    </Box>
  );
};

export default FilePicker;
