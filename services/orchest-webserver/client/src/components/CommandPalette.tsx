import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHotKey } from "@/hooks/useHotKey";
import { siteMap } from "@/Routes";
import { getOrderedRoutes } from "@/routingConfig";
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
import * as React from "react";

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

  const showCommandPalette = () => {
    setIsShowing(true);
  };

  const hideCommandPalette = () => {
    setIsShowing(false);
  };

  const setRootCommands = () => {
    setCommands(commandCache);
  };

  const refreshCache = () => {
    setIsRefreshingCache(true);

    let pipelineCommands = [];
    let projectCommands = [];
    let jobCommands = [];

    let pipelinesPromise = fetchPipelines();
    pipelinesPromise.then((pipelines) => {
      pipelines.forEach((pipeline) => {
        pipelineCommands = pipelineCommands.concat(
          commandsFromPipeline(pipeline)
        );
      });
    });

    let projectsPromise = fetchProjects();
    projectsPromise.then((projects) => {
      projects.forEach((project) => {
        projectCommands = projectCommands.concat(commandsFromProject(project));
      });
    });

    let jobsPromise = fetchJobs();
    jobsPromise.then((jobs) => {
      jobs.forEach((job) => {
        jobCommands = jobCommands.concat(commandsFromJob(job));
      });
    });

    Promise.all([pipelinesPromise, projectsPromise, jobsPromise]).then(() => {
      setCommandCache([
        ...generatePageCommands(),
        ...pipelineCommands,
        ...projectCommands,
        ...jobCommands,
      ]);
      setIsRefreshingCache(false);
    });
  };

  const fetchPipelines: () => Promise<[]> = () => {
    return new Promise((resolve, reject) => {
      let fetchListPromise = makeCancelable(
        makeRequest("GET", `/async/pipelines`),
        promiseManager
      );

      fetchListPromise.promise
        .then((response: string) => {
          resolve(JSON.parse(response)["result"]);
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

  const fetchProjects: () => Promise<[]> = () => {
    return new Promise((resolve) => {
      let fetchListPromise = makeCancelable(
        makeRequest("GET", `/async/projects`),
        promiseManager
      );

      fetchListPromise.promise
        .then((response: string) => {
          let projects = JSON.parse(response);
          resolve(projects);
        })
        .catch((e) => {
          console.error(e);
          resolve([]);
        });
    });
  };

  const fetchJobs: () => Promise<[]> = () => {
    return new Promise((resolve) => {
      let fetchListPromise = makeCancelable(
        makeRequest("GET", `/catch/api-proxy/api/jobs/`),
        promiseManager
      );

      fetchListPromise.promise
        .then((response: string) => {
          let jobs = JSON.parse(response);
          resolve(jobs["jobs"]);
        })
        .catch((e) => {
          console.error(e);
          resolve([]);
        });
    });
  };

  const onQueryChange = (value) => {
    setQuery(value);
  };

  const commandsFromProject = (project: any) => {
    return [
      {
        title: "Project: " + project.path,
        action: "openList",
        data: [
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
      },
    ];
  };

  const commandsFromPipeline = (pipeline: any) => {
    return [
      {
        title: "Pipeline path: " + pipeline.path,
        action: "openList",
        data: [
          {
            title: "Edit pipeline: " + pipeline.path,
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
            title: "JupyterLab: " + pipeline.path,
            action: "openPage",
            data: {
              path: siteMap.jupyterLab.path,
              query: {
                pipelineUuid: pipeline.uuid,
                projectUuid: pipeline.project_uuid,
              },
            },
          },
        ],
      },
      {
        title: "Pipeline name: " + pipeline.name,
        action: "openList",
        data: [
          {
            title: "Edit pipeline: " + pipeline.name,
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
            title: "JupyterLab: " + pipeline.name,
            action: "openPage",
            data: {
              path: siteMap.jupyterLab.path,
              query: {
                pipelineUuid: pipeline.uuid,
                projectUuid: pipeline.project_uuid,
              },
            },
          },
        ],
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
          title: "View job: " + job.name,
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

  const handleCommand = (command) => {
    // Hide command palette before executing command
    setQuery("");

    switch (command.action) {
      case "openPage":
        setIsShowing(false);
        navigateTo(command.data.path, { query: command.data.query });
        break;
      case "openList":
        setCommands(command.data);
        break;
    }
  };

  const filterCommands = (commands, query) => {
    return commands.filter(
      (command) => command.title.toLowerCase().indexOf(query.toLowerCase()) >= 0
    );
  };

  const [enableEnterHotKey] = useHotKey("enter", "command-palette", () => {
    if (filteredCommands[selectedCommandIndex]) {
      handleCommand(filteredCommands[selectedCommandIndex]);
    }
  });

  const [enableUpDownHotKey] = useHotKey("up, down", "command-palette", (e) => {
    if (e.code == "ArrowDown") {
      if (selectedCommandIndex < filteredCommands.length - 1) {
        setSelectedCommandIndex(selectedCommandIndex + 1);
      }
    } else if (e.code == "ArrowUp") {
      if (selectedCommandIndex > 0) {
        setSelectedCommandIndex(selectedCommandIndex - 1);
      }
    }
  });

  const [enableKHotKey] = useHotKey(
    "ctrl+k, command+k",
    "command-palette",
    () => {
      showCommandPalette();
      setRootCommands();
    }
  );

  const [enableEscapeHotKey] = useHotKey("escape", "command-palette", () => {
    hideCommandPalette();
  });

  const selectCommand = (index) => {
    if (filteredCommands[index]) {
      handleCommand(filteredCommands[index]);
    }
  };

  React.useEffect(() => {
    enableKHotKey();
    enableEscapeHotKey();
    enableUpDownHotKey();
    enableEnterHotKey();

    // Load cache on page load
    refreshCache();
  }, []);

  React.useEffect(() => {
    if (isShowing) {
      refManager.refs.search.focus();
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
            <div className="command-list">
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
