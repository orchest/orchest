import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHotKey } from "@/hooks/useHotKey";
import { siteMap } from "@/Routes";
import { getOrderedRoutes } from "@/routingConfig";
import { Job, Project } from "@/types";
import {
  MDCLinearProgressReact,
  MDCListReact,
  MDCTextFieldReact,
} from "@orchest/lib-mdc";
import {
  makeCancelable,
  makeRequest,
  PromiseManager,
  RefManager,
} from "@orchest/lib-utils";
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

const fetcherCreator = (promiseManager: PromiseManager<any>) => {
  return function <T>(path: string, attribute?: string) {
    return new Promise<T[]>((resolve, reject) => {
      let fetchListPromise = makeCancelable(
        makeRequest("GET", path),
        promiseManager
      );

      fetchListPromise.promise
        .then((response: string) => {
          const parsed = JSON.parse(response);
          resolve(attribute ? parsed[attribute] : parsed);
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

const CommandPalette: React.FC = () => {
  const { navigateTo } = useCustomRoute();
  const [isShowing, setIsShowing] = React.useState(false);
  const [isRefreshingCache, setIsRefreshingCache] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = React.useState(0);
  const [commandCache, setCommandCache] = React.useState([]);
  const [commands, setCommands] = React.useState([]);
  const [filteredCommands, setFilteredCommands] = React.useState([]);

  const [refManager] = React.useState(new RefManager());
  const [promiseManager] = React.useState(new PromiseManager());
  const fetcher = fetcherCreator(promiseManager);

  const showCommandPalette = () => {
    setIsShowing(true);
  };

  const hideCommandPalette = () => {
    refreshCache();
    setIsShowing(false);
  };

  const setRootCommands = () => {
    setCommands(commandCache);
  };

  const refreshCache = () => {
    setIsRefreshingCache(true);

    let pipelineCommandsPromise = fetchPipelines().then((pipelines) => {
      return pipelines.reduce((all, pipeline) => {
        return [...all, ...commandsFromPipeline(pipeline)];
      }, []);
    });

    let projectCommandsPromise = fetchProjects().then((projects) => {
      return projects.reduce((all, project) => {
        return [...all, commandsFromProject(project)];
      }, []);
    });

    let jobCommandsPromise = fetchJobs().then((jobs) => {
      return jobs.reduce((all, job) => {
        return [...all, commandsFromJob(job)];
      }, []);
    });

    Promise.all([
      pipelineCommandsPromise,
      projectCommandsPromise,
      jobCommandsPromise,
    ]).then(([pipelineCommands, projectCommands, jobCommands]) => {
      setCommandCache([
        ...generatePageCommands(),
        ...pipelineCommands,
        ...projectCommands,
        ...jobCommands,
      ]);
      setIsRefreshingCache(false);
    });
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

  const onQueryChange = (value: string) => {
    setQuery(value);
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

  const commandsFromPipeline = (pipeline: Pipeline) => {
    const generatePipelineCommands = (pipelineDisplay): Command[] => {
      return [
        {
          title: "Edit: " + pipelineDisplay,
          action: "openPage",
          data: {
            path: siteMap.pipeline.path,
            query: {
              pipelineUuid: pipeline.uuid,
              projectUuid: pipeline.project_uuid,
            },
          },
        },
        {
          title: "JupyterLab: " + pipelineDisplay,
          action: "openPage",
          data: {
            path: siteMap.jupyterLab.path,
            query: {
              pipelineUuid: pipeline.uuid,
              projectUuid: pipeline.project_uuid,
            },
          },
        },
        {
          title: "Settings: " + pipelineDisplay,
          action: "openPage",
          data: {
            path: siteMap.pipelineSettings.path,
            query: {
              pipelineUuid: pipeline.uuid,
              projectUuid: pipeline.project_uuid,
            },
          },
        },
        {
          title: "Logs: " + pipelineDisplay,
          action: "openPage",
          data: {
            path: siteMap.logs.path,
            query: {
              pipelineUuid: pipeline.uuid,
              projectUuid: pipeline.project_uuid,
            },
          },
        },
      ];
    };

    const pipelineName = pipeline.name + " [" + pipeline.path + "]";
    return [
      {
        title: "Pipeline: " + pipelineName,
        action: "openList",
        data: generatePipelineCommands(pipelineName),
      },
    ];
  };

  const commandsFromJob = (job: any) => {
    return job.status == "DRAFT"
      ? {
          title: "Edit job: " + job.name,
          action: "openPage",
          data: {
            path: siteMap.editJob.path,
            query: {
              projectUuid: job.project_uuid,
              jobUuid: job.uuid,
            },
          },
        }
      : {
          title: "Job: " + job.name,
          action: "openPage",
          data: {
            path: siteMap.job.path,
            query: {
              projectUuid: job.project_uuid,
              jobUuid: job.uuid,
            },
          },
        };
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

    return getOrderedRoutes((title) => title)
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
      case "openPage":
        setIsShowing(false);
        navigateTo(command.data.path, { query: command.data.query });
        break;
      case "openList":
        setCommands(command.children);
        break;
    }
  };

  const filterCommands = (commands: Command[], query: string) => {
    return commands.filter((command) =>
      command.title.toLowerCase().includes(query.toLowerCase())
    );
  };

  const [enableEnterHotKey, disableEnterHotKey] = useHotKey("enter", () => {
    if (filteredCommands[selectedCommandIndex]) {
      handleCommand(filteredCommands[selectedCommandIndex]);
    }
  });

  const handleIndexScrollContainer = (index) => {
    // Set scroll position to make sure the selected element is in view
    if (refManager.refs.commandList) {
      const isVisible = (el, holder) => {
        let { top, bottom, height } = el.getBoundingClientRect();

        height = 0; // Show at least full element
        const holderRect = holder.getBoundingClientRect();

        return top <= holderRect.top
          ? [holderRect.top - top <= height, "top"]
          : [bottom - holderRect.bottom <= height, "bottom"];
      };

      let listEl = refManager.refs.commandList.querySelectorAll("li")[index];

      const [visible, position] = isVisible(
        listEl,
        refManager.refs.commandList
      );
      if (!visible) {
        listEl.scrollIntoView(position == "top");
      }
    }
  };

  React.useEffect(() => {
    handleIndexScrollContainer(selectedCommandIndex);
  }, [selectedCommandIndex]);

  const [enableUpDownHotKey, disableUpDownHotKey] = useHotKey(
    "up, down, pageup, pagedown",
    (e) => {
      if (e.code == "ArrowDown") {
        if (selectedCommandIndex < filteredCommands.length - 1) {
          setSelectedCommandIndex(selectedCommandIndex + 1);
        }
      } else if (e.code == "ArrowUp") {
        if (selectedCommandIndex > 0) {
          setSelectedCommandIndex(selectedCommandIndex - 1);
        }
      } else if (e.code == "PageUp") {
        setSelectedCommandIndex(0);
      } else if (e.code == "PageDown") {
        setSelectedCommandIndex(filteredCommands.length - 1);
      }
    }
  );

  const [_, disableKHotKey] = useHotKey("ctrl+k, command+k", () => {
    showCommandPalette();
    setRootCommands();
  });

  const [enableEscapeHotKey, disableEscapeHotKey] = useHotKey("escape", () => {
    hideCommandPalette();
  });

  const selectCommand = (index) => {
    if (filteredCommands[index]) {
      handleCommand(filteredCommands[index]);
    }
  };

  const enableShowOnlyHotKeys = () => {
    enableEscapeHotKey();
    enableUpDownHotKey();
    enableEnterHotKey();
  };

  const disableShowOnlyHotKeys = () => {
    disableEscapeHotKey();
    disableUpDownHotKey();
    disableEnterHotKey();
  };

  React.useEffect(() => {
    // Load cache on page load
    refreshCache();

    return () => {
      disableKHotKey();
      disableShowOnlyHotKeys();
    };
  }, []);

  React.useEffect(() => {
    if (isShowing) {
      refManager.refs.search.focus();
      enableShowOnlyHotKeys();
    } else {
      disableShowOnlyHotKeys();
    }
  }, [isShowing]);

  React.useEffect(() => {
    if (commands.length == 0) {
      setCommands(commandCache);
    }
  }, [commandCache]);

  React.useEffect(() => {
    setFilteredCommands(filterCommands(commands, query));
    setSelectedCommandIndex(0);
  }, [commands, query]);

  return (
    <div>
      {isShowing && (
        <div className="command-palette-holder">
          <div className="command-pallette">
            <div className="search-box">
              <MDCTextFieldReact
                onChange={onQueryChange}
                value={query}
                classNames={["fullwidth"]}
                ref={refManager.nrefs.search}
                label="Command search"
              />
            </div>
            <div className="command-list" ref={refManager.nrefs.commandList}>
              {
                <MDCListReact
                  className="mdc-deprecated-list--dense"
                  selectedIndex={selectedCommandIndex}
                  items={filteredCommands.map((command) => {
                    return { text: command.title, onClick: selectCommand };
                  })}
                />
              }
            </div>
            {isRefreshingCache && <MDCLinearProgressReact />}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandPalette;
