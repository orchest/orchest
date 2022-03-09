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
import { ServiceTemplate } from "@/components/ServiceTemplatesDialog/content";
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
import ListIcon from "@mui/icons-material/List";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import SaveIcon from "@mui/icons-material/Save";
import ViewComfyIcon from "@mui/icons-material/ViewComfy";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
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
import cloneDeep from "lodash.clonedeep";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { getOrderValue } from "./common";
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
    pipelineJson,
    setPipelineJson,
  } = useFetchPipelineMetadata({ projectUuid, pipelineUuid, jobUuid, runUuid });

  React.useEffect(() => {
    if (pipelineJson) {
      dispatch({
        type: "pipelineSet",
        payload: {
          pipelineUuid,
          projectUuid,
          pipelineName: pipelineJson.name,
        },
      });
    }
  }, [pipelineJson, pipelineUuid, projectUuid, dispatch]);

  // local states
  const [inputParameters, setInputParameters] = React.useState<string>(
    JSON.stringify({}, null, 2)
  );

  React.useEffect(() => {
    if (pipelineJson) {
      setInputParameters(JSON.stringify(pipelineJson.parameters));
      dispatch({
        type: "pipelineSet",
        payload: {
          pipelineUuid,
          projectUuid,
          pipelineName: pipelineJson.name,
        },
      });
    }
  }, [pipelineJson, pipelineUuid, projectUuid, dispatch]);

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

  const promiseManagerRef = React.useRef(new PromiseManager());

  const hasLoaded =
    pipelineJson && envVariables && (isReadOnly || projectEnvVariables);

  // If the component has loaded, attach the resize listener
  const overflowListener = React.useRef(new OverflowListener());
  React.useEffect(() => {
    if (hasLoaded) {
      overflowListener.current.attach();
    }
  }, [hasLoaded]);

  const addServiceFromTemplate = (service: ServiceTemplate["config"]) => {
    let clonedService = cloneDeep(service);

    const services = pipelineJson?.services || {};

    const allNames = new Set(Object.values(services).map((s) => s.name));

    let count = 0;
    // assuming that user won't have more than 100 instances of the same service
    while (count < 100) {
      const newName = `${clonedService.name}${count === 0 ? "" : count}`;
      if (!allNames.has(newName)) {
        clonedService.name = newName;
        break;
      }
      count += 1;
    }

    onChangeService(uuidv4(), clonedService);
  };

  const onChangeService = (uuid: string, service: Service) => {
    setPipelineJson((current) => {
      // Maintain client side order key
      if (service.order === undefined) service.order = getOrderValue();
      current.services[uuid] = service;
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
    } catch (err) {}
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
    let pipelineCopy = cloneDeep(pipelineJson);
    for (let uuid in pipelineCopy.services) {
      const serviceName = pipelineCopy.services[uuid].name;
      delete pipelineCopy.services[uuid].order;
      pipelineCopy.services[serviceName] = {
        ...pipelineCopy.services[uuid],
      };
      delete pipelineCopy.services[uuid];
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

  const saveGeneralForm = async (e: React.MouseEvent<HTMLButtonElement>) => {
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
              payload: { pipelineName: pipelineJson?.name },
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
        content: { env_variables: envVariablesObj.value },
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
        promiseManagerRef.current
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

  const serviceRows: DataTableRow<ServiceRow>[] = !pipelineJson
    ? []
    : Object.entries(pipelineJson.services)
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
                services={pipelineJson.services}
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
                          value={pipelineJson?.name}
                          margin="normal"
                          multiline
                          onChange={(e) => onChangeName(e.target.value)}
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
                        <Box sx={{ width: "100%" }}>
                          <Code sx={{ wordBreak: "break-word" }}>
                            {pipelinePath}
                          </Code>
                        </Box>
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
                  </form>
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
