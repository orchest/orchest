import { Box, Dialog, Grid, Stack, styled, Typography } from "@mui/material";
import Paper from "@mui/material/Paper";
import React from "react";

type KeyboardShortcut = {
  keys: string[];
  description: string;
};

type KeyboardGroupShortcut = {
  shortcuts: KeyboardShortcut[];
  description: string;
};

export const keyboardShortcuts: KeyboardGroupShortcut[] = [
  {
    description: "Pipeline editor",
    shortcuts: [
      {
        keys: ["Space", "_click_", "_drag_"],
        description: "Pan canvas*",
      },
      {
        keys: ["Ctrl", "_click_"],
        description: "Select multiple steps",
      },
      {
        keys: ["Ctrl", "A"],
        description: "Select all steps*",
      },
      {
        keys: ["Ctrl", "Enter"],
        description: "Run selected steps*",
      },
      {
        keys: ["H"],
        description: "Center view and reset zoom",
      },
      {
        keys: ["Delete/Backspace"],
        description: "Delete selected step(s)",
      },
      {
        keys: ["_Double click a step_"],
        description: "Open file in JupyterLab",
      },
    ],
  },
  {
    description: "Command palette",
    shortcuts: [
      {
        keys: ["Control/Command", "K"],
        description: "Open command palette",
      },
      {
        keys: ["↑/↓"],
        description: "Navigate command palette commands",
      },
      {
        keys: ["PageUp/PageDown"],
        description: "Navigate command palette commands",
      },
      {
        keys: ["Escape"],
        description: "Dismiss command palette",
      },
    ],
  },
];

export const useKeyboardShortcutsOverlay = (
  shortcuts: KeyboardGroupShortcut[]
) => {
  const [isVisible, setIsVisible] = React.useState(false);

  const Key = styled(Paper)(({ theme }) => ({
    //    backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
    ...theme.typography.body2,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    textAlign: "center",
    color: theme.palette.text.secondary,
  }));

  const contents = (contents: string) =>
    contents.startsWith("_") && contents.endsWith("_") ? (
      <Typography variant="body2">{contents.slice(1, -1)} </Typography>
    ) : (
      <Key>{contents}</Key>
    );

  const keyboardShortcutComponent = (shortcut: KeyboardShortcut) => (
    <Grid
      container
      direction="row"
      justifyContent="space-between"
      style={{ paddingTop: 4 }}
    >
      <Grid item xs={8}>
        {shortcut.description}
      </Grid>
      <Grid item xs={4}>
        <Stack direction="row" spacing={1} divider={<span>+</span>}>
          {shortcut.keys.map(contents)}
        </Stack>
      </Grid>
    </Grid>
  );

  const overlay = (
    <Dialog open={isVisible} onClose={() => setIsVisible(false)} maxWidth="lg">
      <Box
        sx={{
          width: 600,
          p: 4,
        }}
      >
        <Typography variant="h5" component="h2" style={{ paddingBottom: 16 }}>
          Keyboard shortcuts
        </Typography>
        <Stack direction="column" spacing={2}>
          {shortcuts.map((group, i) => (
            <div key={i}>
              <Typography variant="h6" component="h4">
                {group.description}
              </Typography>
              <Stack direction="column" spacing={0}>
                {group.shortcuts.map(keyboardShortcutComponent)}
              </Stack>
            </div>
          ))}
        </Stack>
        <Typography variant="body2">
          * Requires mouse to hover the canvas
        </Typography>
      </Box>
    </Dialog>
  );

  return { overlay, setIsVisible };
};

export default useKeyboardShortcutsOverlay;
