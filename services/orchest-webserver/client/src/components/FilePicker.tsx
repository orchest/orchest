import { FileApiOverrides, useFileApi } from "@/api/files/useFileApi";
import { useHasChanged } from "@/hooks/useHasChanged";
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
import Divider from "@mui/material/Divider";
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
import { hasValue } from "@orchest/lib-utils";
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
  overrides?: FileApiOverrides;
  fileFilter?: (path: string) => boolean;
  accepts?: (path: string) => boolean;
  onChange?: (root: FileRoot, path: string) => void;
};

export const FilePicker = ({
  root: startingRoot = "/project-dir",
  hideRoots,
  hideCreateFile,
  selected,
  accepts,
  overrides,
  fileFilter: fileFilter = () => true,
  onChange,
}: FilePickerProps) => {
  selected = addLeadingSlash(selected ?? "/");
  const roots = useFileApi((api) => api.roots);
  const expand = useFileApi((api) => api.expand);
  const init = useFileApi((api) => api.init);
  const [path, setPath] = React.useState(selected ?? "/");
  const [root, setRoot] = React.useState(startingRoot);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isCreatingFile, setIsCreatingFile] = React.useState(false);
  const overridesRef = React.useRef(overrides);
  overridesRef.current = overrides;

  /** The path if `path` is a directory, otherwise the dirname of the `path`. */
  const cwd = React.useMemo(() => {
    if (!path) return "/";
    else if (isDirectory(path)) return addLeadingSlash(path);
    else return addLeadingSlash(dirname(path));
  }, [path]);

  const rootChanged = useHasChanged(root, (p, c) => hasValue(p) && p !== c);

  React.useEffect(() => {
    init(undefined, overridesRef.current);
    setRoot((currentRoot) => currentRoot ?? "/project-dir");
  }, [init, root]);

  React.useEffect(() => {
    if (!rootChanged) return;
    init(undefined, overridesRef.current);
  }, [init, rootChanged]);

  const bestMatch = React.useMemo(() => {
    const name = basename(path);
    const directory = addLeadingSlash(isDirectory(path) ? path : dirname(path));

    if (!roots[root]) return undefined;

    return Object.keys(directChildren(roots[root], directory)).sort(
      (left, right) =>
        getMatchScore(basename(right), name) -
        getMatchScore(basename(left), name)
    )[0];
  }, [roots, root, path]);

  React.useEffect(() => {
    expand(root, cwd, overridesRef.current);
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

  if (Object.keys(roots[root] ?? {}).length === 0) return null;

  const errorText = !roots[root][path] ? "File not found" : undefined;

  return (
    <Box position="relative">
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
          startAdornment: (
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
        {!hideRoots && (
          <>
            <FormControl fullWidth sx={{ paddingBottom: 3 }}>
              <FormLabel sx={{ padding: (theme) => theme.spacing(2) }}>
                Location
              </FormLabel>
              <RadioGroup
                sx={{ padding: (theme) => theme.spacing(0, 3) }}
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
                      <Radio
                        sx={{ marginRight: (theme) => theme.spacing(1) }}
                      />
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>
            <Divider />
          </>
        )}
        <FormControl fullWidth>
          <FormLabel sx={{ padding: (theme) => theme.spacing(2) }}>
            <PathBreadcrumbs root={root} path={cwd} onChange={setPath} />
          </FormLabel>

          <MenuList>
            {Object.keys(directChildren(roots[root], cwd))
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
            {Object.keys(directChildren(roots[root], cwd))
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
            <Stack direction="row" justifyContent="center" marginTop={1}>
              <Button
                startIcon={<AddOutlined />}
                onClick={() => setIsCreatingFile(true)}
              >
                New file
              </Button>
            </Stack>
            {!hideCreateFile && (
              <CreateFileDialog
                root={root}
                cwd={cwd}
                isOpen={isCreatingFile}
                onSuccess={(file) => selectPath(file.path)}
                hideCreateStep={true}
                onClose={closeMenu}
                canCreateStep={false}
              />
            )}
          </MenuList>
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
