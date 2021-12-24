import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHotKeys } from "@/hooks/useHotKeys";
import { siteMap } from "@/Routes";
import { getOrderedRoutes } from "@/routingConfig";
import { Job, Project } from "@/types";
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

const fetcherCreator = () => {
  return function <T>(path: string, attribute?: string) {
    return new Promise<T[]>((resolve, reject) => {
      fetcher(path)
        .then((response) => {
          resolve(attribute ? response[attribute] : response);
        })
        .catch((e) => {
          console.error(e);
          reject([]);
        })
        .finally(() => {
          resolve([]);
        });
    });
  };
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
        path: siteMap.pipelineSettings.path,
        query: {
          pipelineUuid: uuid,
          projectUuid: project_uuid,
        },
      },
    },
    {
      title: `Logs: ${pipelineDisplay}`,
      action: "openPage",
      data: {
        path: siteMap.logs.path,
        query: {
          pipelineUuid: uuid,
          projectUuid: project_uuid,
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
        title: "Project settings: " + project.path,
        action: "openPage",
        data: {
          path: siteMap.projectSettings.path,
          query: {
            projectUuid: project.uuid,
          },
        },
      },
      {
        title: "Pipelines: " + project.path,
        action: "openPage",
        data: {
          path: siteMap.pipelines.path,
          query: {
            projectUuid: project.uuid,
          },
        },
      },
    ],
  };
};

const commandsFromJob = (projectPaths: Record<string, string>, job: Job) => {
  const title =
    job.status == "DRAFT"
      ? `Edit job: ${job.name} [${projectPaths[job.project_uuid]}]`
      : `Job: ${job.name} [${projectPaths[job.project_uuid]}]`;
  const path = job.status == "DRAFT" ? siteMap.editJob.path : siteMap.job.path;
  return {
    title,
    action: "openPage",
    data: {
      path,
      query: { projectUuid: job.project_uuid, jobUuid: job.uuid },
    },
  };
};

const CommandPalette: React.FC = () => {
  // global states
  const {
    state: { isCommandPaletteOpen },
    dispatch,
  } = useAppContext();
  const { navigateTo } = useCustomRoute();

  // local states
  const [isRefreshingCache, setIsRefreshingCache] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = React.useState(0);
  const commandCache = React.useRef<Command[]>([]);
  const [commands, setCommands] = React.useState<Command[]>([]);

  const commandListRef = React.useRef<HTMLDivElement>();

  const filteredCommands = React.useMemo(() => {
    return (commands || []).filter((command) =>
      command.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [commands, query]);

  const fetcher = fetcherCreator();

  const showCommandPalette = () => {
    dispatch({
      type: "SET_IS_COMMAND_PALETTE_OPEN",
      payload: true,
    });
  };

  const hideCommandPalette = () => {
    dispatch({
      type: "SET_IS_COMMAND_PALETTE_OPEN",
      payload: false,
    });
  };

  const setRootCommands = () => {
    setCommands(commandCache.current);
  };

  const refreshCache = async () => {
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

    Promise.all([pipelineCommandsPromise, jobCommandsPromise]).then(
      ([pipelineCommands, jobCommands]) => {
        commandCache.current = [
          ...generatePageCommands(),
          ...projectCommands.list,
          ...pipelineCommands,
          ...jobCommands,
        ];
        setCommands(commandCache.current);
        setIsRefreshingCache(false);
      }
    );
  };

  const fetchPipelines = () => {
    return fetcher<Pipeline>("/async/pipelines", "result");
  };

  const fetchProjects = () => {
    return fetcher<Project>("/async/projects");
  };

  const fetchJobs = () => {
    return fetcher<Job>("/catch/api-proxy/api/jobs/", "jobs");
  };

  const onQueryChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setQuery(e.target.value);
  };

  const generatePageCommands = () => {
    // Exclude detail views
    const excludedPaths = [
      siteMap.pipeline.path,
      siteMap.environment.path,
      siteMap.pipelineSettings.path,
      siteMap.projectSettings.path,
      siteMap.jupyterLab.path,
      siteMap.filePreview.path,
      siteMap.logs.path,
      siteMap.job.path,
      siteMap.editJob.path,
    ];

    return getOrderedRoutes((title: string) => title)
      .filter((route) => excludedPaths.indexOf(route.path) == -1)
      .map((route) => {
        return {
          title: "Page: " + route.title,
          action: "openPage",
          data: { path: route.path, query: {} },
        };
      });
  };

  const handleCommand = (command: Command) => {
    // Hide command palette before executing command
    setQuery("");

    switch (command.action) {
      case "openPage": {
        hideCommandPalette();
        navigateTo(command.data.path, { query: command.data.query });
        break;
      }
      case "openList":
        setCommands(command.children);
        break;
    }
  };

  const handleIndexScrollContainer = (index: number) => {
    // Set scroll position to make sure the selected element is in view
    if (commandListRef.current) {
      const isVisible = (el, holder) => {
        let { top, bottom, height } = el.getBoundingClientRect();

        height = 0; // Show at least full element
        const holderRect = holder.getBoundingClientRect();

        return top <= holderRect.top
          ? [holderRect.top - top <= height, "top"]
          : [bottom - holderRect.bottom <= height, "bottom"];
      };

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
      all: {
        "ctrl+k, command+k": (event) => {
          event.preventDefault();
          showCommandPalette();
          setRootCommands();
        },
      },
      command: {
        "up, down, pageup, pagedown, escape, enter": (e, hotKeyEvent) => {
          if (hotKeyEvent.key === "escape") hideCommandPalette();
          if (hotKeyEvent.key === "enter") {
            if (filteredCommands[selectedCommandIndex]) {
              handleCommand(filteredCommands[selectedCommandIndex]);
            }
          }
          if (["down", "up", "pageup", "pagedown"].includes(hotKeyEvent.key))
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
        },
      },
    },
    [selectedCommandIndex, filteredCommands]
  );

  const selectCommand = (index) => {
    if (filteredCommands[index]) {
      handleCommand(filteredCommands[index]);
    }
  };

  const enableCommandMode = () => {
    setScope("command");
  };

  const disableCommandMode = () => {
    setScope("all");
  };

  React.useEffect(() => {
    return () => disableCommandMode();
  }, []);

  React.useEffect(() => {
    if (isCommandPaletteOpen) {
      enableCommandMode();
    } else {
      disableCommandMode();
      refreshCache();
    }
  }, [isCommandPaletteOpen]);

  React.useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commands, query]);

  if (!isCommandPaletteOpen) return null;

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
                  key={command.title}
                  onClick={selectCommand}
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

export default CommandPalette;
