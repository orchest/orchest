import { Code } from "@/components/common/Code";
import { IconButton } from "@/components/common/IconButton";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import EnvVarList, { EnvVarPair } from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ServiceForm from "@/components/ServiceForm";
import { ServiceTemplatesDialog } from "@/components/ServiceTemplatesDialog";
import { ServiceTemplate } from "@/components/ServiceTemplatesDialog/content";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { useSessionsPoller } from "@/hooks/useSessionsPoller";
import { siteMap } from "@/Routes";
import type {
  PipelineJson,
  Service,
  TViewPropsWithRequiredQueryArgs,
} from "@/types";
import {
  envVariablesArrayToDict,
  envVariablesDictToArray,
  getPipelineJSONEndpoint,
  isValidEnvironmentVariableName,
  OverflowListener,
  validatePipeline,
} from "@/utils/webserver-utils";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import ListIcon from "@mui/icons-material/List";
import MemoryIcon from "@mui/icons-material/Memory";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import SaveIcon from "@mui/icons-material/Save";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  Alert as CustomAlert,
  AlertDescription,
  AlertHeader,
  IconLightBulbOutline,
  Link,
} from "@orchest/design-system";
import {
  fetcher,
  makeCancelable,
  makeRequest,
  PromiseManager,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import _ from "lodash";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import useSWR from "swr";
import { MutatorCallback } from "swr/dist/types";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(4, 0),
}));

export type IPipelineSettingsView = TViewPropsWithRequiredQueryArgs<
  "pipeline_uuid" | "project_uuid"
>;

const tabMapping: Record<string, number> = {
  configuration: 0,
  "environment-variables": 1,
  services: 2,
};

const tabs = [
  {
    id: "configuration",
    label: "Configuration",
    icon: <ListIcon />,
  },
  {
    id: "environment-variables",
    label: "Environment variables",
    icon: <ViewComfyIcon />,
  },
  {
    id: "services",
    label: "Services",
    icon: <MiscellaneousServicesIcon />,
  },
];

const getOrderValue = () => {
  const lsKey = "_monotonic_getOrderValue";
  // returns monotinically increasing digit
  if (!window.localStorage.getItem(lsKey)) {
    window.localStorage.setItem(lsKey, "0");
  }
  let value = parseInt(window.localStorage.getItem(lsKey)) + 1;
  window.localStorage.setItem(lsKey, value + "");
  return value;
};

const fetchPipelineJson = (callback: (data: PipelineJson) => void) => async (
  url: string
) => {
  const response = await fetcher<{ pipeline_json: string }>(url);
  const pipelineObj = JSON.parse(response.pipeline_json) as PipelineJson;
  // as settings are optional, populate defaults if no values exist
  if (pipelineObj.settings === undefined) {
    pipelineObj.settings = {};
  }
  if (pipelineObj.settings.auto_eviction === undefined) {
    pipelineObj.settings.auto_eviction = false;
  }
  if (pipelineObj.settings.data_passing_memory_size === undefined) {
    pipelineObj.settings.data_passing_memory_size = "1GB";
  }
  if (pipelineObj.parameters === undefined) {
    pipelineObj.parameters = {};
  }
  if (pipelineObj.services === undefined) {
    pipelineObj.services = {};
  }

  // Augment services with order key
  for (let service in pipelineObj.services) {
    pipelineObj.services[service].order = getOrderValue();
  }

  callback(pipelineObj);

  return pipelineObj;
};

const isValidMemorySize = (value: string) =>
  value.match(/^(\d+(\.\d+)?\s*(KB|MB|GB))$/);

const scopeMap = {
  interactive: "Interactive sessions",
  noninteractive: "Job sessions",
};

const PipelineSettingsView: React.FC = () => {
  // global states
  const projectsContext = useProjectsContext();
  const {
    state: { hasUnsavedChanges },
    setAlert,
    setConfirm,
    setAsSaved,
  } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.pipelineSettings.path });

  const sessionsContext = useSessionsContext();
  const { getSession } = sessionsContext;
  useSessionsPoller();

  // data from route
  const {
    navigateTo,
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    initialTab,
    isReadOnly,
  } = useCustomRoute();

  const setHeaderComponent = (pipelineName: string) =>
    projectsContext.dispatch({
      type: "pipelineSet",
      payload: {
        pipelineUuid,
        projectUuid,
        pipelineName,
      },
    });

  // local states
  const [inputParameters, setInputParameters] = React.useState<string>(
    JSON.stringify({}, null, 2)
  );
  const { data: pipelineJson, mutate, revalidate: fetchPipeline } = useSWR<
    PipelineJson
  >(
    getPipelineJSONEndpoint(pipelineUuid, projectUuid, jobUuid, runUuid),
    fetchPipelineJson((data) => {
      setHeaderComponent(data.name);
      setInputParameters(JSON.stringify(data.parameters));
    })
  );

  // use mutate to act like local state setter
  const setPipelineJson = (
    data?: PipelineJson | Promise<PipelineJson> | MutatorCallback<PipelineJson>
  ) => mutate(data, false);

  const [tabIndex, setTabIndex] = React.useState<number>(
    tabMapping[initialTab] || 0 // note that initialTab can be 'null' since it's a querystring
  );

  // const [pipelineJson, setPipelineJson] = React.useState<PipelineJson>();
  const [servicesChanged, setServicesChanged] = React.useState(false);

  const [envVariables, _setEnvVariables] = React.useState<EnvVarPair[]>([]);
  const setEnvVariables = (value: React.SetStateAction<EnvVarPair[]>) => {
    _setEnvVariables(value);
    setAsSaved(false);
  };

  const [state, setState] = React.useState({
    restartingMemoryServer: false,
    pipeline_path: undefined,
    projectEnvVariables: [],
    environmentVariablesChanged: false,
  });

  const session = getSession({
    pipelineUuid,
    projectUuid,
  });
  if (
    !session &&
    !hasUnsavedChanges &&
    (servicesChanged || state.environmentVariablesChanged)
  ) {
    setServicesChanged(false);
    setState((prevState) => ({
      ...prevState,
      environmentVariablesChanged: false,
    }));
  }

  const [overflowListener] = React.useState(new OverflowListener());
  const promiseManagerRef = React.useRef(new PromiseManager<string>());

  // const fetchPipelineData = () => {
  //   fetchPipeline();
  //   fetchPipelineMetadata();
  // };

  const hasLoaded = () => {
    return (
      pipelineJson && envVariables && (isReadOnly || state.projectEnvVariables)
    );
  };

  // Fetch pipeline data on initial mount
  React.useEffect(() => {
    // fetchPipelineData();
    fetchPipelineMetadata();
    return () => promiseManagerRef.current.cancelCancelablePromises();
  }, []);

  // If the component has loaded, attach the resize listener
  React.useEffect(() => {
    if (hasLoaded()) {
      attachResizeListener();
    }
  }, [state]);

  const addServiceFromTemplate = (service: ServiceTemplate["config"]) => {
    let clonedService = _.cloneDeep(service);

    // Take care of service name collisions
    let x = 1;
    let baseServiceName = clonedService.name;
    while (x < 100) {
      if (pipelineJson.services[clonedService.name] == undefined) {
        break;
      }
      clonedService.name = baseServiceName + x;
      x++;
    }

    onChangeService(clonedService);
  };

  const onChangeService = (service: Service) => {
    setPipelineJson((current) => {
      // Maintain client side order key
      if (service.order === undefined) service.order = getOrderValue();
      current.services[service.name] = service;
      return current;
    });

    setServicesChanged(true);
    setAsSaved(false);
  };

  const nameChangeService = (oldName: string, newName: string) => {
    setPipelineJson((current) => {
      current[newName] = current[oldName];
      delete current.services[oldName];
      return current;
    });
    setServicesChanged(true);
    setAsSaved(false);
  };

  const deleteService = async (serviceName: string) => {
    setPipelineJson((current) => {
      delete current.services[serviceName];
      return current;
    });

    setServicesChanged(true);
    setAsSaved(false);
    return true;
  };

  const attachResizeListener = () => overflowListener.attach();

  const onSelectTab = (
    e: React.SyntheticEvent<Element, Event>,
    index: number
  ) => {
    setTabIndex(index);
  };

  const fetchPipelineMetadata = () => {
    if (!jobUuid) {
      // get pipeline path
      let cancelableRequest = makeCancelable<string>(
        makeRequest(
          "GET",
          `/async/pipelines/${projectUuid}/${pipelineUuid}`
        ) as Promise<string>,
        promiseManagerRef.current
      );

      cancelableRequest.promise.then((response: string) => {
        let pipeline = JSON.parse(response);

        _setEnvVariables(envVariablesDictToArray(pipeline["env_variables"]));

        setState((prevState) => ({
          ...prevState,
          pipeline_path: pipeline.path,
        }));
      });

      // get project environment variables
      let cancelableProjectRequest = makeCancelable<string>(
        makeRequest("GET", `/async/projects/${projectUuid}`) as Promise<string>,
        promiseManagerRef.current
      );

      cancelableProjectRequest.promise
        .then((response) => {
          let project = JSON.parse(response);

          setState((prevState) => ({
            ...prevState,
            projectEnvVariables: envVariablesDictToArray(
              project["env_variables"]
            ),
          }));
        })
        .catch((error) => {
          console.error(error);
        });
    } else {
      let cancelableJobPromise = makeCancelable<string>(
        makeRequest("GET", `/catch/api-proxy/api/jobs/${jobUuid}`) as Promise<
          string
        >,
        promiseManagerRef.current
      );
      let cancelableRunPromise = makeCancelable<string>(
        makeRequest(
          "GET",
          `/catch/api-proxy/api/jobs/${jobUuid}/${runUuid}`
        ) as Promise<string>,
        promiseManagerRef.current
      );

      Promise.all([
        cancelableJobPromise.promise.then((response) => {
          let job = JSON.parse(response);
          return job.pipeline_run_spec.run_config.pipeline_path;
        }),

        cancelableRunPromise.promise.then((response) => {
          let run = JSON.parse(response);
          return envVariablesDictToArray(run["env_variables"]);
        }),
      ])
        .then((values) => {
          let [pipeline_path, envVariables] = values;
          _setEnvVariables(envVariables);
          setState((prevState) => ({
            ...prevState,
            pipeline_path,
          }));
        })
        .catch((err) => console.log(err));
    }
  };

  const closeSettings = () => {
    navigateTo(siteMap.pipeline.path, {
      query: {
        projectUuid,
        pipelineUuid,
        jobUuid,
        runUuid,
      },
      state: { isReadOnly },
    });
  };

  const onChangeName = (value: string) => {
    setPipelineJson((current) => ({ ...current, name: value }));
    setAsSaved(false);
  };

  const onChangePipelineParameters = (editor, data, value) => {
    setInputParameters(value);

    try {
      const parametersJSON = JSON.parse(value);
      setPipelineJson((current) => ({
        ...current,
        parameters: parametersJSON,
      }));

      setAsSaved(false);
    } catch (err) {
      console.log("JSON did not parse");
    }
  };

  const onChangeDataPassingMemorySize = (value: string) => {
    setPipelineJson((current) => {
      return {
        ...current,
        settings: { ...current.settings, data_passing_memory_size: value },
      };
    });
    setAsSaved(false);
  };

  const onChangeEviction = (value: boolean) => {
    setPipelineJson((current) => {
      return {
        ...current,
        settings: { ...current.settings, auto_eviction: value },
      };
    });

    setAsSaved(false);
  };

  const cleanPipelineJson = (
    pipelineJson: PipelineJson
  ): Omit<PipelineJson, "order"> => {
    let pipelineCopy = _.cloneDeep(pipelineJson);
    for (let serviceName in pipelineCopy.services) {
      delete pipelineCopy.services[serviceName].order;
    }
    return pipelineCopy;
  };

  const validateServiceEnvironmentVariables = (pipeline: any) => {
    for (let serviceName in pipeline.services) {
      let service = pipeline.services[serviceName];

      if (service.env_variables === undefined) {
        continue;
      }

      for (let envVariableName of Object.keys(service.env_variables)) {
        if (!isValidEnvironmentVariableName(envVariableName)) {
          setAlert(
            "Error",
            `Invalid environment variable name: "${envVariableName}" in service "${service.name}".`
          );
          return false;
        }
      }
    }
    return true;
  };

  const saveGeneralForm = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // Remove order property from services
    let cleanedPipelineJson = cleanPipelineJson(pipelineJson);

    let validationResult = validatePipeline(cleanedPipelineJson);
    if (!validationResult.valid) {
      setAlert("Error", validationResult.errors[0]);
      return;
    }

    // Validate environment variables of services
    if (!validateServiceEnvironmentVariables(cleanedPipelineJson)) {
      return;
    }

    let envVariablesObj = envVariablesArrayToDict(envVariables);
    // Do not go through if env variables are not correctly defined.
    if (envVariablesObj.status === "rejected") {
      setAlert("Error", envVariablesObj.error);
      setTabIndex(1);
      return;
    }

    // Validate pipeline level environment variables
    for (let envVariableName of Object.keys(envVariablesObj.value)) {
      if (!isValidEnvironmentVariableName(envVariableName)) {
        setAlert(
          "Error",
          `Invalid environment variable name: "${envVariableName}".`
        );
        setTabIndex(1);
        return;
      }
    }

    let formData = new FormData();
    formData.append("pipeline_json", JSON.stringify(cleanedPipelineJson));

    makeRequest(
      "POST",
      `/async/pipelines/json/${projectUuid}/${pipelineUuid}`,
      { type: "FormData", content: formData }
    )
      .then((response: string) => {
        let result = JSON.parse(response);
        if (result.success) {
          setState((prevState) => ({
            ...prevState,
          }));
          setAsSaved();

          // Sync name changes with the global context
          projectsContext.dispatch({
            type: "pipelineSet",
            payload: {
              pipelineName: pipelineJson?.name,
            },
          });
        }
      })
      .catch((response) => {
        console.error("Could not save: pipeline definition OR Notebook JSON");
        console.error(response);
      });

    makeRequest("PUT", `/async/pipelines/${projectUuid}/${pipelineUuid}`, {
      type: "json",
      content: { env_variables: envVariablesObj.value },
    }).catch((response) => {
      console.error(response);
    });
  };

  const restartMemoryServer = () => {
    if (!state.restartingMemoryServer) {
      setState((prevState) => ({
        ...prevState,
        restartingMemoryServer: true,
      }));

      // perform POST to save
      let restartPromise = makeCancelable(
        makeRequest(
          "PUT",
          `/catch/api-proxy/api/sessions/${projectUuid}/${pipelineUuid}`
        ),
        promiseManagerRef.current
      );

      restartPromise.promise
        .then(() => {
          setState((prevState) => ({
            ...prevState,
            restartingMemoryServer: false,
          }));
        })
        .catch((response) => {
          if (!response.isCanceled) {
            let errorMessage =
              "Could not clear memory server, reason unknown. Please try again later.";
            try {
              errorMessage = JSON.parse(response.body)["message"];
              if (errorMessage == "SessionNotRunning") {
                errorMessage =
                  "Session is not running, please try again later.";
              }
            } catch (error) {
              console.error(error);
            }

            setAlert("Error", errorMessage);

            setState((prevState) => ({
              ...prevState,
              restartingMemoryServer: false,
            }));
          }
        });
    } else {
      console.error(
        "Already busy restarting memory server. UI should prohibit this call."
      );
    }
  };

  type ServiceRow = { name: string; scope: string; remove: string };

  const columns: DataTableColumn<ServiceRow>[] = [
    { id: "name", label: "Service" },
    { id: "scope", label: "Scope" },
    {
      id: "remove",
      label: "Delete",
      render: function ServiceDeleteButton(row) {
        return (
          <IconButton
            title="Delete"
            disabled={isReadOnly}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setConfirm(
                "Warning",
                "Are you sure you want to delete the service: " +
                  row.name +
                  "?",
                async () => deleteService(row.name)
              );
            }}
          >
            <DeleteIcon />
          </IconButton>
        );
      },
    },
  ];

  const serviceRows: DataTableRow<ServiceRow>[] = !pipelineJson
    ? []
    : Object.entries(pipelineJson.services)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([key, service]) => {
          return {
            uuid: key,
            name: key,
            scope: service.scope
              .map((scopeAsString) => scopeMap[scopeAsString])
              .join(", "),
            remove: key,
            details: (
              <ServiceForm
                key={`ServiceForm-${key}`}
                service={service}
                disabled={isReadOnly}
                updateService={onChangeService}
                nameChangeService={nameChangeService}
                pipeline_uuid={pipelineUuid}
                project_uuid={projectUuid}
                run_uuid={runUuid}
              />
            ),
          };
        });

  const isMemorySizeValid = isValidMemorySize(
    pipelineJson?.settings?.data_passing_memory_size || ""
  );

  return (
    <Layout>
      <div className="view-page pipeline-settings-view">
        {hasLoaded() ? (
          <div className="pipeline-settings">
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6" component="h2">
                Pipeline settings
              </Typography>
              <IconButton
                title="Close"
                onClick={closeSettings}
                data-test-id="pipeline-settings-close"
              >
                <CloseIcon />
              </IconButton>
            </Stack>

            <Tabs
              value={tabIndex}
              onChange={onSelectTab}
              label="View pipeline settings"
              data-test-id="pipeline-settings"
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.id}
                  id={tab.id}
                  label={<TabLabel icon={tab.icon}>{tab.label}</TabLabel>}
                  aria-controls={tab.id}
                  data-test-id={`${tab.id}-tab`}
                />
              ))}
            </Tabs>

            <div className="tab-view trigger-overflow">
              <CustomTabPanel value={tabIndex} index={0} name="configuration">
                <div className="configuration">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div className="columns">
                      <div className="column">
                        <h3>Name</h3>
                      </div>
                      <div className="column">
                        <TextField
                          value={pipelineJson?.name}
                          margin="normal"
                          onChange={(e) => onChangeName(e.target.value)}
                          label="Pipeline name"
                          disabled={isReadOnly}
                          data-test-id="pipeline-settings-configuration-pipeline-name"
                        />
                      </div>
                      <div className="clear"></div>
                    </div>

                    <div className="columns">
                      <div className="column">
                        <h3>Path</h3>
                      </div>
                      <div className="column">
                        {state.pipeline_path && (
                          <p className="push-down">
                            <Code>{state.pipeline_path}</Code>
                          </p>
                        )}
                      </div>
                      <div className="clear"></div>
                    </div>

                    <div className="columns">
                      <div className="column">
                        <h3>Pipeline parameters</h3>
                      </div>
                      <div className="column">
                        <CodeMirror
                          value={inputParameters}
                          options={{
                            mode: "application/json",
                            theme: "jupyter",
                            lineNumbers: true,
                            readOnly: isReadOnly,
                          }}
                          onBeforeChange={onChangePipelineParameters}
                        />
                        {(() => {
                          try {
                            JSON.parse(inputParameters);
                          } catch {
                            return (
                              <div className="warning push-up push-down">
                                <i className="material-icons">warning</i> Your
                                input is not valid JSON.
                              </div>
                            );
                          }
                        })()}
                      </div>
                      <div className="clear"></div>
                    </div>

                    <div className="columns">
                      <div className="column">
                        <h3>Data passing</h3>
                      </div>
                      <Stack
                        direction="column"
                        spacing={2}
                        alignItems="flex-start"
                      >
                        {!isReadOnly && (
                          <Alert severity="info">
                            For these changes to take effect you have to restart
                            the memory-server (see button below).
                          </Alert>
                        )}
                        <FormGroup>
                          <FormControlLabel
                            label={
                              <Typography
                                component="span"
                                variant="body1"
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                Automatic memory eviction
                                <Tooltip title="Auto eviction makes sure outputted objects are evicted once all depending steps have obtained it as an input.">
                                  <InfoIcon
                                    fontSize="small"
                                    aria-describedby="tooltip-memory-eviction"
                                    sx={{
                                      marginLeft: (theme) => theme.spacing(1),
                                    }}
                                  />
                                </Tooltip>
                              </Typography>
                            }
                            data-test-id="pipeline-settings-configuration-memory-eviction"
                            disabled={isReadOnly}
                            control={
                              <Checkbox
                                checked={pipelineJson?.settings?.auto_eviction}
                                onChange={(e) => {
                                  onChangeEviction(e.target.checked);
                                }}
                              />
                            }
                          />
                        </FormGroup>

                        {!isReadOnly && (
                          <Typography
                            sx={{ marginBottom: (theme) => theme.spacing(2) }}
                          >
                            {`Change the size of the memory server for data
                            passing. For units use KB, MB, or GB, e.g. `}
                            <Code>1GB</Code>.
                          </Typography>
                        )}

                        <TextField
                          value={pipelineJson.settings.data_passing_memory_size}
                          onChange={(e) =>
                            onChangeDataPassingMemorySize(e.target.value)
                          }
                          margin="normal"
                          label="Data passing memory size"
                          disabled={isReadOnly}
                          data-test-id="pipeline-settings-configuration-memory-size"
                        />
                        {!isMemorySizeValid && (
                          <Alert severity="warning">
                            Not a valid memory size.
                          </Alert>
                        )}
                      </Stack>
                      <div className="clear"></div>
                    </div>
                  </form>

                  {!isReadOnly && (
                    <div className="columns">
                      <div className="column">
                        <h3>Actions</h3>
                      </div>
                      <div className="column">
                        <p className="push-down">
                          Restarting the memory-server also clears the memory to
                          allow additional data to be passed between pipeline
                          steps.
                        </p>
                        <div className="push-down">
                          {(() => {
                            if (state.restartingMemoryServer) {
                              return (
                                <p className="push-p push-down">
                                  Restarting in progress...
                                </p>
                              );
                            }
                          })()}

                          <Button
                            disabled={state.restartingMemoryServer}
                            color="secondary"
                            variant="contained"
                            startIcon={<MemoryIcon />}
                            onClick={restartMemoryServer}
                            data-test-id="pipeline-settings-configuration-restart-memory-server"
                          >
                            Restart memory-server
                          </Button>
                        </div>
                      </div>
                      <div className="clear"></div>
                    </div>
                  )}
                </div>
              </CustomTabPanel>
              <CustomTabPanel
                value={tabIndex}
                index={1}
                name="environment-variables"
              >
                {state.environmentVariablesChanged && session && (
                  <Alert severity="warning">
                    Note: changes to environment variables require a session
                    restart to take effect.
                  </Alert>
                )}
                {isReadOnly ? (
                  <EnvVarList
                    value={envVariables}
                    readOnly
                    data-test-id="pipeline-read-only"
                  />
                ) : (
                  <Stack
                    direction="column"
                    alignItems="flex-start"
                    spacing={3}
                    sx={{ width: "60%" }}
                  >
                    <Stack spacing={2}>
                      <Typography component="h3" variant="h6">
                        Project environment variables
                      </Typography>
                      <EnvVarList
                        value={state.projectEnvVariables}
                        readOnly
                        data-test-id="project-read-only"
                      />
                    </Stack>
                    <Alert severity="info">
                      Pipeline environment variables take precedence over
                      project environment variables.
                    </Alert>
                    <Stack spacing={2}>
                      <Typography component="h3" variant="h6">
                        Pipeline environment variables
                      </Typography>
                      <EnvVarList
                        value={envVariables}
                        setValue={setEnvVariables}
                        data-test-id="pipeline"
                      />
                    </Stack>
                  </Stack>
                )}
              </CustomTabPanel>
              <CustomTabPanel value={tabIndex} index={2} name="services">
                <Stack direction="column" spacing={2} alignItems="flex-start">
                  {servicesChanged && session && (
                    <Alert severity="warning">
                      Note: changes to environment variables require a session
                      restart to take effect.
                    </Alert>
                  )}
                  <DataTable<ServiceRow>
                    hideSearch
                    id="service-list"
                    columns={columns}
                    rows={serviceRows}
                  />
                  <CustomAlert status="info">
                    <AlertHeader>
                      <IconLightBulbOutline />
                      Want to start using Services?
                    </AlertHeader>
                    <AlertDescription>
                      <Link
                        target="_blank"
                        href="https://docs.orchest.io/en/stable/fundamentals/services.html"
                        rel="noopener noreferrer"
                      >
                        Learn more about how to expand your pipeline’s
                        capabilities.
                      </Link>
                    </AlertDescription>
                  </CustomAlert>
                  {!isReadOnly && (
                    <ServiceTemplatesDialog
                      onSelection={(template) =>
                        addServiceFromTemplate(template)
                      }
                    />
                  )}
                </Stack>
              </CustomTabPanel>
            </div>

            {!isReadOnly && (
              <div className="bottom-buttons observe-overflow">
                <Button
                  variant="contained"
                  onClick={saveGeneralForm}
                  startIcon={<SaveIcon />}
                  disabled={!isMemorySizeValid}
                  data-test-id="pipeline-settings-save"
                >
                  {hasUnsavedChanges ? "SAVE*" : "SAVE"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <LinearProgress />
        )}
      </div>
    </Layout>
  );
};

export default PipelineSettingsView;
