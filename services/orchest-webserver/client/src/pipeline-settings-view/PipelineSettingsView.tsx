import { Code } from "@/components/common/Code";
import { IconButton } from "@/components/common/IconButton";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import {
  DataTable,
  DataTableColumn,
  DataTableRow,
} from "@/components/DataTable";
import EnvVarList from "@/components/EnvVarList";
import { Layout } from "@/components/Layout";
import ServiceForm from "@/components/ServiceForm";
import { ServiceTemplatesDialog } from "@/components/ServiceTemplatesDialog";
import { useAppContext } from "@/contexts/AppContext";
import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useSessionsContext } from "@/contexts/SessionsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type {
  PipelineJson,
  Service,
  TViewPropsWithRequiredQueryArgs,
} from "@/types";
import {
  envVariablesArrayToDict,
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
  hasValue,
  makeCancelable,
  makeRequest,
  PromiseManager,
  uuidv4,
} from "@orchest/lib-utils";
import "codemirror/mode/javascript/javascript";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import {
  generatePipelineJsonForSaving,
  getOrderValue,
  instantiateNewService,
} from "./common";
import { useFetchPipelineMetadata } from "./useFetchPipelineMetadata";

const CustomTabPanel = styled(TabPanel)(({ theme }) => ({
  padding: theme.spacing(4, 0),
}));

const scopeMap = {
  interactive: "Interactive sessions",
  noninteractive: "Job sessions",
};

const isValidMemorySize = (value: string) =>
  value.match(/^(\d+(\.\d+)?\s*(KB|MB|GB))$/);

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

const PipelineSettingsView: React.FC = () => {
  // global states
  const { dispatch } = useProjectsContext();
  const {
    state: { hasUnsavedChanges },
    setAlert,
    setConfirm,
    setAsSaved,
  } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.pipelineSettings.path });

  // data from route
  const {
    navigateTo,
    projectUuid,
    pipelineUuid,
    jobUuid,
    runUuid,
    initialTab,
    isReadOnly: isReadOnlyFromQueryString,
  } = useCustomRoute();

  const { getSession } = useSessionsContext();

  const isReadOnly =
    (hasValue(runUuid) && hasValue(jobUuid)) || isReadOnlyFromQueryString;

  // Fetching data
  const {
    projectEnvVariables,
    envVariables,
    setEnvVariables,
    pipelinePath,
    setPipelinePath,
    services,
    setServices,
    settings,
    setSettings,
    pipelineJson,
    pipelineName,
    setPipelineName,
    inputParameters,
    setInputParameters,
  } = useFetchPipelineMetadata({ projectUuid, pipelineUuid, jobUuid, runUuid });

  // local states

  const allServiceNames = React.useMemo(() => {
    return new Set(Object.values(services || {}).map((s) => s.name));
  }, [services]);

  const [tabIndex, setTabIndex] = React.useState<number>(
    tabMapping[initialTab] || 0 // note that initialTab can be 'null' since it's a querystring
  );

  const [servicesChanged, setServicesChanged] = React.useState(false);
  const [restartingMemoryServer, setRestartingMemoryServer] = React.useState(
    false
  );
  const [envVarsChanged, setEnvVarsChanged] = React.useState(false);

  const session = getSession({
    pipelineUuid,
    projectUuid,
  });
  if (!session && !hasUnsavedChanges && (servicesChanged || envVarsChanged)) {
    setServicesChanged(false);
    setEnvVarsChanged(false);
  }

  const promiseManager = React.useMemo(() => new PromiseManager(), []);

  const hasLoaded =
    pipelineJson && envVariables && (isReadOnly || projectEnvVariables);

  // If the component has loaded, attach the resize listener
  const overflowListener = React.useMemo(() => new OverflowListener(), []);
  React.useEffect(() => {
    if (hasLoaded) {
      overflowListener.attach();
    }
  }, [hasLoaded, overflowListener]);

  const onChangeService = (uuid: string, service: Service) => {
    setServices((current) => {
      // Maintain client side order key
      if (service.order === undefined) service.order = getOrderValue();
      current[uuid] = service;
      return current;
    });

    setServicesChanged(true);
    setAsSaved(false);
  };

  const deleteService = async (serviceUuid: string) => {
    setServices((current) => {
      const { [serviceUuid]: serviceToRemove, ...remainder } = current; // eslint-disable-line @typescript-eslint/no-unused-vars
      return remainder;
    });

    setServicesChanged(true);
    setAsSaved(false);
    return true;
  };

  const onSelectTab = (
    e: React.SyntheticEvent<Element, Event>,
    index: number
  ) => {
    setTabIndex(index);
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

  const onChangePipelineParameters = (editor, data, value: string) => {
    setInputParameters(value);
  };

  const onChangeDataPassingMemorySize = (value: string) => {
    setSettings((current) => {
      return { ...current, data_passing_memory_size: value };
    });
  };

  const onChangeEviction = (value: boolean) => {
    setSettings((current) => {
      return { ...current, auto_eviction: value };
    });
  };

  const validateServiceEnvironmentVariables = (pipeline: PipelineJson) => {
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

  const saveGeneralForm = async () => {
    // do not mutate the original pipelineJson
    // put all mutations together for saving
    const updatedPipelineJson = generatePipelineJsonForSaving({
      pipelineJson,
      inputParameters,
      pipelineName,
      services,
      settings,
    });

    let validationResult = validatePipeline(updatedPipelineJson);
    if (!validationResult.valid) {
      setAlert("Error", validationResult.errors[0]);
      return;
    }

    // Validate environment variables of services
    if (!validateServiceEnvironmentVariables(updatedPipelineJson)) {
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
    formData.append("pipeline_json", JSON.stringify(updatedPipelineJson));

    Promise.allSettled([
      makeRequest(
        "POST",
        `/async/pipelines/json/${projectUuid}/${pipelineUuid}`,
        { type: "FormData", content: formData }
      )
        .then((response: string) => {
          let result = JSON.parse(response);
          if (result.success) {
            // Sync name changes with the global context
            dispatch({
              type: "pipelineSet",
              payload: { pipelineName },
            });
          }
        })
        .catch((response) => {
          setAlert(
            "Error",
            "Could not save: pipeline definition OR Notebook JSON"
          );

          console.error(response);
          return Promise.reject(response);
        }),
      makeRequest("PUT", `/async/pipelines/${projectUuid}/${pipelineUuid}`, {
        type: "json",
        content: {
          env_variables: envVariablesObj.value,
          path: !session ? pipelinePath : undefined, // path cannot be changed when there is an active session
        },
      }).catch((response) => {
        setAlert("Error", "Could not save: environment variables");
        console.error(response);
        return Promise.reject(response);
      }),
    ]).then((value) => {
      const isAllSaved = !value.some((p) => p.status === "rejected");
      setAsSaved(isAllSaved);
    });
  };

  const restartMemoryServer = () => {
    if (!restartingMemoryServer) {
      setRestartingMemoryServer(true);

      // perform POST to save
      let restartPromise = makeCancelable(
        makeRequest(
          "PUT",
          `/catch/api-proxy/api/sessions/${projectUuid}/${pipelineUuid}`
        ),
        promiseManager
      );

      restartPromise.promise
        .then(() => {
          setRestartingMemoryServer(false);
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
            setRestartingMemoryServer(false);
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
                `Are you sure you want to delete the service: ${row.name}?`,
                async (resolve) => {
                  deleteService(row.uuid)
                    .then(() => {
                      resolve(true);
                    })
                    .catch((error) => {
                      setAlert("Error", `Unable to delete service ${row.name}`);
                      console.error(error);
                      resolve(false);
                    });
                  return true;
                }
              );
            }}
          >
            <DeleteIcon />
          </IconButton>
        );
      },
    },
  ];

  const serviceRows: DataTableRow<ServiceRow>[] = Object.entries(services)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, service]) => {
      return {
        uuid: key,
        name: service.name,
        scope: service.scope
          .map((scopeAsString) => scopeMap[scopeAsString])
          .join(", "),
        remove: key,
        details: (
          <ServiceForm
            key={key}
            serviceUuid={key}
            service={service}
            services={services}
            disabled={isReadOnly}
            updateService={(updated) => onChangeService(key, updated)}
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
        {hasLoaded ? (
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
                          value={pipelineName}
                          margin="normal"
                          multiline
                          onChange={(e) => setPipelineName(e.target.value)}
                          label="Pipeline name"
                          disabled={isReadOnly}
                          fullWidth
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
                        <TextField
                          value={pipelinePath}
                          margin="normal"
                          multiline
                          onChange={(e) => setPipelinePath(e.target.value)}
                          label="Pipeline path"
                          disabled={isReadOnly || hasValue(session)}
                          helperText={
                            session
                              ? "You need to stop session before changing pipeline path"
                              : ""
                          }
                          fullWidth
                          data-test-id="pipeline-settings-configuration-pipeline-path"
                        />
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
                            if (restartingMemoryServer) {
                              return (
                                <p className="push-p push-down">
                                  Restarting in progress...
                                </p>
                              );
                            }
                          })()}

                          <Button
                            disabled={restartingMemoryServer}
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
                {envVarsChanged && session && (
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
                        value={projectEnvVariables}
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
                      onSelection={(template) => {
                        const newService = instantiateNewService(
                          allServiceNames,
                          template
                        );
                        onChangeService(uuidv4(), newService);
                      }}
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
