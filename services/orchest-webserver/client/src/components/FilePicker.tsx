import { FileScope, useFileApi } from "@/api/files/useFileApi";
import { useFetchFileRoots } from "@/hooks/useFetchFileRoots";
import { prettifyRoot } from "@/pipeline-view/file-manager/common";
import { CreateFileDialog } from "@/pipeline-view/file-manager/CreateFileDialog";
import { getIcon, SVGFileIcon } from "@/pipeline-view/file-manager/SVGFileIcon";
import { FileRoot, fileRoots } from "@/utils/file";
import { directoryContents } from "@/utils/file-map";
import {
  addLeadingSlash,
  basename,
  dirname,
  filename,
  isDirectory,
  trimLeadingSlash,
} from "@/utils/path";
import { AddOutlined, FolderOutlined } from "@mui/icons-material";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";
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
  scope?: FileScope;
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
  const { roots } = useFetchFileRoots(scope);
  const expand = useFileApi((api) => api.expand);

  const [path, setPath] = React.useState(selected ?? "/");
  const [bestMatch, setBestMatch] = React.useState("");
  const [root, setRoot] = React.useState(startingRoot);
  const [isOpen, setIsOpen] = React.useState(false);
  const inputContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isCreatingFile, setIsCreatingFile] = React.useState(false);
  const [expanding, setExpanding] = React.useState(false);
  const bestMatchRef = React.useRef<HTMLLIElement | null>(null);
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;

  const fileMap = roots[root];

  /** The path if `path` is a directory, otherwise the dirname of the `path`. */
  const cwd = React.useMemo(() => {
    if (!path) return "/";
    else if (isDirectory(path)) return addLeadingSlash(path);
    else return addLeadingSlash(dirname(path));
  }, [path]);

  const contents = React.useMemo(() => {
    const paths = Object.keys(directoryContents(fileMap ?? {}, cwd)).filter(
      (child) => isDirectory(child) || fileFilter(child)
    );

    const search = filename(path).toLowerCase();
    const matchesSearch = (child: string) =>
      !search || basename(child).toLowerCase().includes(search);

    // When the file picker is opened when a path has previously
    // been selected, we don't want a filter based on search,
    // since that will make the file picker look almost empty/broken.
    return selected !== path ? paths.filter(matchesSearch) : paths;
  }, [path, fileMap, cwd, selected, fileFilter]);

  React.useEffect(() => {
    setExpanding(true);

    expand(root, cwd, scopeRef.current).then(() => setExpanding(false));
  }, [cwd, expand, root]);

  const openMenu = React.useCallback(() => {
    setIsOpen(true);
  }, []);
  const closeMenu = React.useCallback(() => {
    setIsCreatingFile(false);
    setIsOpen(false);
  }, []);

  const selectPath = React.useCallback(
    (newPath: string) => {
      setPath(newPath);

      if (accepts?.(newPath) ?? true) {
        onChange?.(root, newPath);
        closeMenu();
      }
    },
    [accepts, closeMenu, onChange, root]
  );

  React.useEffect(() => {
    const name = basename(path);

    if (!fileMap) return undefined;

    const newBestMatch = [...contents].sort(
      (left, right) =>
        getMatchScore(basename(right), name) -
        getMatchScore(basename(left), name)
    )[0];

    setBestMatch(newBestMatch);
  }, [contents, path, fileMap]);

  React.useEffect(() => {
    // Ensure that the best match is always visible.
    bestMatchRef.current?.scrollIntoView({ block: "nearest" });
  }, [bestMatch]);

  React.useEffect(() => {
    if (isOpen) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [isOpen]);

  const onKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = contents[contents.indexOf(bestMatch) + 1];

        setBestMatch((current) => next ?? current);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const previous = contents[contents.indexOf(bestMatch) - 1];

        setBestMatch((current) => previous ?? current);
      }
    },
    [bestMatch, isOpen, contents]
  );

  const onKeyUp = React.useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "Enter") {
        event.preventDefault();
        if (bestMatch) {
          selectPath(bestMatch);
        }
      } else if (event.key === "Escape") {
        setIsOpen(false);
      }
    },
    [bestMatch, isOpen, selectPath]
  );

  const errorText =
    !expanding && !fileMap?.[path] ? "File not found" : undefined;

  React.useEffect(() => {
    document.addEventListener("keyup", onKeyUp);

    return () => document.removeEventListener("keyup", onKeyUp);
  }, [onKeyUp]);

  React.useEffect(() => {
    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <Box position="relative">
      {!hideRoots && (
        <FormControl fullWidth sx={{ paddingBottom: 3 }}>
          <FormLabel>Location</FormLabel>
          <RadioGroup
            sx={{ padding: (theme) => theme.spacing(0, 1) }}
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
                control={<Radio />}
              />
            ))}
          </RadioGroup>
        </FormControl>
      )}
      <TextField
        label="File path"
        autoComplete="off"
        fullWidth
        error={Boolean(errorText)}
        helperText={errorText}
        value={trimLeadingSlash(path)}
        onChange={({ target }) => setPath(target.value)}
        // This is the input element:
        inputProps={{ ref: inputRef, onFocus: openMenu }}
        // This is its container:
        InputProps={{
          ref: inputContainerRef,
          sx: { paddingRight: 1 },
          startAdornment: hideRoots && (
            <InputAdornment position="start" sx={{ pointerEvents: "none" }}>
              {prettifyRoot(root)}/
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end" sx={{ pointerEvents: "none" }}>
              <ArrowDropDown
                sx={{
                  transform: isOpen ? "rotateZ(180deg)" : undefined,
                }}
              />
            </InputAdornment>
          ),
        }}
      />
      <Popover
        open={isOpen}
        onClose={closeMenu}
        anchorEl={inputContainerRef.current}
        disableAutoFocus={true}
        disableRestoreFocus={true}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{
          sx: { marginTop: 1, overflow: "hidden" },
          style: {
            width: inputContainerRef.current?.clientWidth,
          },
        }}
      >
        <FormControl fullWidth>
          <FormLabel sx={{ padding: (theme) => theme.spacing(2) }}>
            <PathBreadcrumbs root={root} path={cwd} onChange={setPath} />
          </FormLabel>

          <MenuList sx={{ maxHeight: 200, overflow: "auto" }}>
            {contents.map((child) => (
              <MenuItem
                key={child}
                onClick={() => selectPath(child)}
                selected={bestMatch === child}
                ref={bestMatch === child ? bestMatchRef : null}
              >
                {isDirectory(child) ? (
                  <>
                    <ListItemIcon>
                      <FolderOutlined />
                    </ListItemIcon>
                    <ListItemText>{basename(child)}/</ListItemText>
                  </>
                ) : (
                  <>
                    <ListItemIcon>
                      <SVGFileIcon icon={getIcon(child)} />
                    </ListItemIcon>
                    <ListItemText>{basename(child)}</ListItemText>
                  </>
                )}
              </MenuItem>
            ))}
          </MenuList>

          {!hideCreateFile && (
            <Stack direction="row" justifyContent="center" marginTop={1}>
              <Button
                fullWidth
                startIcon={<AddOutlined />}
                onClick={() => setIsCreatingFile(true)}
              >
                New file
              </Button>

              <CreateFileDialog
                root={root}
                cwd={cwd}
                isOpen={isCreatingFile}
                onSuccess={(file) => selectPath(file.path)}
                hideCreateStep={true}
                onClose={closeMenu}
                canCreateStep={false}
              />
            </Stack>
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
