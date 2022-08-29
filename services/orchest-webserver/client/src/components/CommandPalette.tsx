import { projectsApi } from "@/api/projects/projectsApi";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHotKeys } from "@/hooks/useHotKeys";
import { getPageCommands, siteMap } from "@/routingConfig";
import { JobData, Project } from "@/types";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import TextField from "@mui/material/TextField";
import { fetcher } from "@orchest/lib-utils";
import React from "react";

type Pipeline = {
  name: string;
  path: string;
  project_uuid: string;
  uuid: string;
};

type Command = {
  title: string;
  action: string;
  children?: Command[];
  data?: {
    path: string;
    query: Record<string, string>; // the query param for navigateTo function
  };
};

async function fetchObjects<T>(path: string, attribute?: string): Promise<T[]> {
  try {
    const response = await fetcher<Record<string, T[]> | T[]>(path);
    return attribute ? response[attribute] : response;
  } catch (error) {
    console.error(error);
    return [];
  }
}

const fetchPipelines = () => {
  return fetchObjects<Pipeline>("/async/pipelines", "result");
};

const fetchProjects = () => projectsApi.fetchAll();

const fetchJobs = () => {
  return fetchObjects<JobData>("/catch/api-proxy/api/jobs", "jobs");
};

type ProjectObject = { list: Command[]; paths: Record<string, string> };

const generatePipelineCommands = (
  projectPaths: Record<string, string>,
  { name, project_uuid, uuid }: Pick<Pipeline, "name" | "project_uuid" | "uuid">
): Command[] => {
  const pipelineDisplay = `${name} [${projectPaths[project_uuid]}]`;

  return [
    {
      title: `Edit: ${pipelineDisplay}`,
      action: "openPage",
      data: {
        path: siteMap.pipeline.path,
        query: {
          pipelineUuid: uuid,
          projectUuid: project_uuid,
        },
      },
    },
    {
      title: `JupyterLab: ${pipelineDisplay}`,
      action: "openPage",
      data: {
        path: siteMap.jupyterLab.path,
        query: {
          pipelineUuid: uuid,
          projectUuid: project_uuid,
        },
      },
    },
    {
      title: `Settings: ${pipelineDisplay}`,
      action: "openPage",
      data: {
        path: siteMap.pipeline.path,
        query: {
          pipelineUuid: uuid,
          projectUuid: project_uuid,
          tab: "configuration",
        },
      },
    },
    {
      title: `Logs: ${pipelineDisplay}`,
      action: "openPage",
      data: {
        path: siteMap.pipeline.path,
        query: {
          pipelineUuid: uuid,
          projectUuid: project_uuid,
          tab: "logs",
        },
      },
    },
  ];
};

const commandsFromPipeline = (
  projectPaths: Record<string, string>,
  pipeline: Pipeline
) => {
  const pipelineName = `${pipeline.name} [${
    projectPaths[pipeline.project_uuid]
  }]`;
  return {
    title: `Pipeline: ${pipelineName}`,
    action: "openList",
    children: generatePipelineCommands(projectPaths, pipeline),
  };
};

const commandsFromProject = (project: Project): Command => {
  return {
    title: "Project: " + project.path,
    action: "openList",
    children: [
      {
        title: `Project settings: ${project.path}`,
        action: "openPage",
        data: {
          path: siteMap.projectSettings.path,
          query: { projectUuid: project.uuid },
        },
      },
      {
        title: `Jobs: ${project.path}`,
        action: "openPage",
        data: {
          path: siteMap.jobs.path,
          query: { projectUuid: project.uuid },
        },
      },
      {
        title: `Environments: ${project.path}`,
        action: "openPage",
        data: {
          path: siteMap.environments.path,
          query: { projectUuid: project.uuid },
        },
      },
    ],
  };
};

const commandsFromJob = (
  projectPaths: Record<string, string>,
  job: JobData
) => {
  const title =
    job.status == "DRAFT"
      ? `Edit job: ${job.name} [${projectPaths[job.project_uuid]}]`
      : `Job: ${job.name} [${projectPaths[job.project_uuid]}]`;
  return {
    title,
    action: "openPage",
    data: {
      path: siteMap.jobs.path,
      query: { projectUuid: job.project_uuid, jobUuid: job.uuid },
    },
  };
};

const isVisible = (el: HTMLLIElement, holder: HTMLDivElement) => {
  let { top, bottom, height } = el.getBoundingClientRect();

  height = 0; // Show at least full element
  const holderRect = holder.getBoundingClientRect();

  return top <= holderRect.top
    ? [holderRect.top - top <= height, "top"]
    : [bottom - holderRect.bottom <= height, "bottom"];
};

export const CommandPalette: React.FC = () => {
  // global states
  const { navigateTo, projectUuid } = useCustomRoute();

  const [isOpen, setIsOpen] = React.useState(false);

  // local states
  const [isRefreshingCache, setIsRefreshingCache] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = React.useState(0);
  const [commands, setCommands] = React.useState<Command[]>([]);

  const commandListRef = React.useRef<HTMLDivElement | null>(null);

  const filteredCommands = React.useMemo(() => {
    return (commands || []).filter((command) =>
      command.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [commands, query]);

  const refreshCache = React.useCallback(async () => {
    try {
      setIsRefreshingCache(true);

      const projectCommands = await fetchProjects().then((projects) => {
        return projects.reduce(
          (all, project) => {
            return {
              list: [...all.list, commandsFromProject(project)],
              paths: { ...all.paths, [project.uuid]: project.path },
            };
          },
          { list: [], paths: {} } as ProjectObject
        );
      });

      const pipelineCommandsPromise = fetchPipelines().then((pipelines) => {
        return pipelines.map((pipeline) => {
          return commandsFromPipeline(projectCommands.paths, pipeline);
        });
      });

      const jobCommandsPromise = fetchJobs().then((jobs) => {
        return jobs.map((job) => {
          return commandsFromJob(projectCommands.paths, job);
        });
      });

      const [pipelineCommands, jobCommands] = await Promise.all([
        pipelineCommandsPromise,
        jobCommandsPromise,
      ]);

      setCommands([
        ...getPageCommands(projectUuid),
        ...projectCommands.list,
        ...pipelineCommands,
        ...jobCommands,
      ]);
      setIsRefreshingCache(false);
    } catch (error) {
      // handle failure silently because this is done in the background
      console.error(`Failed to fetch for command palette: ${error}`);
    }
  }, [projectUuid]);

  const onQueryChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setQuery(e.target.value);
  };

  const handleCommand = (command: Command) => {
    // Hide command palette before executing command
    setQuery("");

    switch (command.action) {
      case "openPage": {
        if (command.data) {
          hideCommandPalette();
          navigateTo(command.data.path, { query: command.data.query });
        }
        break;
      }
      case "openList":
        if (command.children) setCommands(command.children);
        break;
    }
  };

  const handleIndexScrollContainer = (index: number) => {
    // Set scroll position to make sure the selected element is in view
    if (commandListRef.current) {
      let listEl = commandListRef.current.querySelectorAll("li")[index];

      if (listEl) {
        const [visible, position] = isVisible(listEl, commandListRef.current);
        if (!visible) {
          listEl.scrollIntoView(position == "top");
        }
      }
    }
  };

  React.useEffect(() => {
    handleIndexScrollContainer(selectedCommandIndex);
  }, [selectedCommandIndex]);

  const { setScope } = useHotKeys(
    {
      command: {
        "up, down, pageup, pagedown, escape, enter": (e, hotKeyEvent) => {
          if (hotKeyEvent.key === "escape") hideCommandPalette();
          if (hotKeyEvent.key === "enter") {
            if (filteredCommands[selectedCommandIndex]) {
              handleCommand(filteredCommands[selectedCommandIndex]);
            }
          }
          if (["down", "up", "pageup", "pagedown"].includes(hotKeyEvent.key)) {
            setSelectedCommandIndex((current) => {
              if (hotKeyEvent.key == "down") {
                if (current < filteredCommands.length - 1) {
                  return current + 1;
                }
              } else if (hotKeyEvent.key == "up") {
                if (current > 0) {
                  return current - 1;
                }
              } else if (hotKeyEvent.key == "pageup") {
                return 0;
              } else if (hotKeyEvent.key == "pagedown") {
                return filteredCommands.length - 1;
              }
              return current;
            });
          }
        },
      },
    },
    [selectedCommandIndex, filteredCommands]
  );

  const selectCommand = (index: number) => {
    if (filteredCommands[index]) {
      handleCommand(filteredCommands[index]);
    }
  };

  const enableCommandMode = React.useCallback(() => {
    setScope("command");
  }, [setScope]);

  const showCommandPalette = React.useCallback(() => {
    setIsOpen(true);
    enableCommandMode();
  }, [enableCommandMode]);

  React.useEffect(() => {
    // `Jupyter` passes its the keyboard events in the JupyterLab iframe to the current document object.
    // However, hotkeys is unable to intercept this keyboard event, therefore we need to add event listener manually.
    // We can consider getting rid of hotkeys-js since we don't have complex hotkeys.
    const eventListener = (event: KeyboardEvent) => {
      if (
        !event.altKey &&
        !event.shiftKey &&
        (event.ctrlKey || event.metaKey) &&
        event.key === "k"
      ) {
        event.preventDefault();
        event.stopPropagation();
        showCommandPalette();
      }
    };
    document.addEventListener("keydown", eventListener);
    return () => {
      document.removeEventListener("keydown", eventListener);
    };
  }, [showCommandPalette]);

  const disableCommandMode = React.useCallback(() => {
    setScope("all");
  }, [setScope]);

  React.useEffect(() => {
    refreshCache();
    disableCommandMode();
    return () => disableCommandMode();
  }, [disableCommandMode, refreshCache]);

  const hideCommandPalette = () => {
    setIsOpen(false);
    disableCommandMode();
    refreshCache();
  };

  React.useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commands, query]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-holder">
      <div className="command-pallette">
        <Box
          sx={{
            marginBottom: (theme) => theme.spacing(2),
            backgroundColor: (theme) => theme.palette.common.white,
            borderRadius: "4px",
          }}
        >
          <TextField
            fullWidth
            color="secondary"
            onChange={onQueryChange}
            value={query}
            autoFocus
            placeholder="Command search"
          />
        </Box>
        <div className="command-list" ref={commandListRef}>
          <List>
            {filteredCommands.map((command, i) => {
              return (
                <ListItem
                  selected={selectedCommandIndex === i}
                  key={i} // command.title is not unique if there are jobs with same name
                  onClick={() => selectCommand(i)}
                >
                  {command.title}
                </ListItem>
              );
            })}
          </List>
        </div>
        {isRefreshingCache && <LinearProgress />}
      </div>
    </div>
  );
};
