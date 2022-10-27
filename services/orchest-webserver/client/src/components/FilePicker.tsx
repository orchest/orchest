import { FileApiOverrides, useFileApi } from "@/api/files/useFileApi";
import { useFetchFileRoots } from "@/hooks/useFetchFileRoots";
import { prettifyRoot } from "@/pipeline-view/file-manager/common";
import { CreateFileDialog } from "@/pipeline-view/file-manager/CreateFileDialog";
import { getIcon, SVGFileIcon } from "@/pipeline-view/file-manager/SVGFileIcon";
import { FileRoot, fileRoots } from "@/utils/file";
import { directChildren } from "@/utils/file-map";
import {
  addLeadingSlash,
  basename,
  dirname,
  isDirectory,
  trimLeadingSlash,
} from "@/utils/path";
import { AddOutlined, FolderOutlined } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";
import Popover from "@mui/material/Popover";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import React from "react";
import { PathBreadcrumbs } from "./PathBreadcrumbs";

export type FilePickerProps = {
  /**
   * A path to the currently selected folder or file relative to the root.
   * This path determines the starting CWD as well.
   */
  selected?: string;
  /** The root to start in. Defaults to `"/project-dir". */
  root?: FileRoot;
  /** Hides the root selector in the file picker. */
  hideRoots?: boolean;
  /** Hides the create file button in the file picker. */
  hideCreateFile?: boolean;
  /** Override the automatically set scope parameters. */
  scope?: FileApiOverrides;
  /** Called once an accepted path has been selected. */
  onChange?: (root: FileRoot, path: string) => void;
  /** Only show files matching this filter. */
  fileFilter?: (path: string) => boolean;
  /**
   * Which paths are accepted and will trigger `onChange`.
   * By default, all non-directories are accepted.
   */
  accepts?: (path: string) => boolean;
};

export const FilePicker = ({
  root: startingRoot = "/project-dir",
  hideRoots,
  hideCreateFile,
  selected,
  scope,
  onChange,
  fileFilter = () => true,
  accepts = (path) => !isDirectory(path),
}: FilePickerProps) => {
  selected = addLeadingSlash(selected ?? "/");
  const roots = useFetchFileRoots(scope);
  const expand = useFileApi((api) => api.expand);
  const [path, setPath] = React.useState(selected ?? "/");
  const [root, setRoot] = React.useState(startingRoot);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isCreatingFile, setIsCreatingFile] = React.useState(false);
  const [expanding, setExpanding] = React.useState(false);
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;

  /** The path if `path` is a directory, otherwise the dirname of the `path`. */
  const cwd = React.useMemo(() => {
    if (!path) return "/";
    else if (isDirectory(path)) return addLeadingSlash(path);
    else return addLeadingSlash(dirname(path));
  }, [path]);

  const bestMatch = React.useMemo(() => {
    const name = basename(path);
    const directory = addLeadingSlash(isDirectory(path) ? path : dirname(path));

    if (!roots[root]) return undefined;

    return Object.keys(directChildren(roots[root] ?? {}, directory)).sort(
      (left, right) =>
        getMatchScore(basename(right), name) -
        getMatchScore(basename(left), name)
    )[0];
  }, [roots, root, path]);

  React.useEffect(() => {
    setExpanding(true);

    expand(root, cwd, scopeRef.current).then(() => setExpanding(false));
  }, [cwd, expand, root]);

  const openMenu = React.useCallback(() => {
    setIsMenuOpen(true);
  }, []);
  const closeMenu = React.useCallback(() => {
    setIsCreatingFile(false);
    setIsMenuOpen(false);
  }, []);

  const selectPath = (newPath: string) => {
    setPath(newPath);

    if (accepts?.(newPath) ?? true) {
      onChange?.(root, newPath);
      closeMenu();
    }
  };

  if (!roots[root]) return null;

  const errorText =
    !expanding && !roots[root]?.[path] ? "File not found" : undefined;

  return (
    <Box position="relative">
      {!hideRoots && (
        <FormControl fullWidth sx={{ paddingBottom: 3 }}>
          <FormLabel>Location</FormLabel>
          <RadioGroup
            sx={{ padding: (theme) => theme.spacing(0, 3) }}
            row={true}
            defaultValue={startingRoot}
            value={root}
            onChange={(event) => {
              setRoot(event.target.value as FileRoot);
              setPath("/");
            }}
          >
            {fileRoots.map((root) => (
              <FormControlLabel
                key={root}
                value={root}
                label={prettifyRoot(root)}
                control={
                  <Radio sx={{ marginRight: (theme) => theme.spacing(1) }} />
                }
              />
            ))}
          </RadioGroup>
        </FormControl>
      )}
      <TextField
        label="File path"
        fullWidth
        error={Boolean(errorText)}
        helperText={errorText}
        value={trimLeadingSlash(path)}
        onChange={({ target }) => setPath(target.value)}
        onKeyUp={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (bestMatch) {
              selectPath(bestMatch);
            }
          }
        }}
        InputProps={{
          onFocus: openMenu,
          ref: inputRef,
          startAdornment: hideRoots && (
            <InputAdornment position="start">
              {prettifyRoot(root)}/
            </InputAdornment>
          ),
        }}
      />
      <Popover
        open={isMenuOpen}
        onClose={closeMenu}
        anchorEl={inputRef.current}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{
          sx: { marginTop: 1 },
          style: {
            width: inputRef.current?.clientWidth,
          },
        }}
      >
        <FormControl fullWidth>
          <FormLabel sx={{ padding: (theme) => theme.spacing(2) }}>
            <PathBreadcrumbs root={root} path={cwd} onChange={setPath} />
          </FormLabel>

          <MenuList>
            {Object.keys(directChildren(roots[root] ?? {}, cwd))
              .filter(isDirectory)
              .map((directoryPath) => (
                <MenuItem
                  key={directoryPath}
                  onClick={() => selectPath(directoryPath)}
                  selected={bestMatch === directoryPath}
                >
                  <ListItemIcon>
                    <FolderOutlined />
                  </ListItemIcon>
                  <ListItemText>{basename(directoryPath)}/</ListItemText>
                </MenuItem>
              ))}
            {Object.keys(directChildren(roots[root] ?? {}, cwd))
              .filter((path) => !isDirectory(path) && fileFilter(path))
              .map((filePath) => (
                <MenuItem
                  key={filePath}
                  onClick={() => selectPath(filePath)}
                  selected={bestMatch === filePath}
                >
                  <ListItemIcon>
                    <SVGFileIcon icon={getIcon(filePath)} />
                  </ListItemIcon>
                  <ListItemText>{basename(filePath)}</ListItemText>
                </MenuItem>
              ))}
          </MenuList>
          {!hideCreateFile && (
            <>
              <Stack direction="row" justifyContent="center" marginTop={1}>
                <Button
                  startIcon={<AddOutlined />}
                  onClick={() => setIsCreatingFile(true)}
                >
                  New file
                </Button>
              </Stack>

              <CreateFileDialog
                root={root}
                cwd={cwd}
                isOpen={isCreatingFile}
                onSuccess={(file) => selectPath(file.path)}
                hideCreateStep={true}
                onClose={closeMenu}
                canCreateStep={false}
              />
            </>
          )}
        </FormControl>
      </Popover>
    </Box>
  );
};

const getMatchScore = (left: string, right: string) => {
  left = left.toLowerCase();
  right = right.toLowerCase();

  let score = 0;

  for (let i = 0; i < left.length; i++) {
    if (left[i] === right[i]) {
      score++;
    } else {
      break;
    }
  }

  return score;
};
