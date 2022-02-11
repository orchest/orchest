import { BackButton } from "@/components/common/BackButton";
import { PageTitle } from "@/components/common/PageTitle";
import { TabLabel, TabPanel, Tabs } from "@/components/common/Tabs";
import ImageBuildLog from "@/components/ImageBuildLog";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironment } from "@/hooks/useFetchEnvironment";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { Environment, EnvironmentBuild } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import MemoryIcon from "@mui/icons-material/Memory";
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import ViewHeadlineIcon from "@mui/icons-material/ViewHeadline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  DEFAULT_BASE_IMAGES,
  fetcher,
  HEADER,
  LANGUAGE_MAP,
  makeCancelable,
  makeRequest,
  PromiseManager,
  uuidv4,
} from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { ContainerImagesRadioGroup } from "./ContainerImagesRadioGroup";
import { CustomImageDialog } from "./CustomImageDialog";
import { useAutoSaveEnvironment } from "./useAutoSaveEnvironment";

const CANCELABLE_STATUSES = ["PENDING", "STARTED"];

const tabs = [
  {
    id: "environment-properties",
    label: "Properties",
    icon: <TuneIcon />,
  },
  {
    id: "environment-build",
    label: "Build",
    icon: <ViewHeadlineIcon />,
  },
];

const validEnvironmentName = (name: string) => {
  if (!name) {
    return false;
  }
  // Negative lookbehind. Check that every " is escaped with \
  for (let x = 0; x < name.length; x++) {
    if (name[x] == '"') {
      if (x == 0) {
        return false;
      } else {
        if (name[x - 1] != "\\") {
          return false;
        }
      }
    }
  }
  return true;
};

/**
 * We apply auto-save to environment edit view
 * so setAsSaved does not apply in this view
 */

const EnvironmentEditView: React.FC = () => {
  // global states
  const {
    setAlert,
    state: { config, hasUnsavedChanges },
  } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.environment.path });

  // data from route
  const { projectUuid, environmentUuid, navigateTo } = useCustomRoute();

  // local states

  const isNewEnvironment = environmentUuid === "new";
  const {
    environment,
    setEnvironment,
    isFetchingEnvironment,
    customImage,
    setCustomImage,
  } = useFetchEnvironment({
    // if environment is new, don't pass the uuid, so this hook won't fire the request
    uuid: !isNewEnvironment ? environmentUuid : "",
    project_uuid: projectUuid,
    ...config.ENVIRONMENT_DEFAULTS,
  });

  const [
    isShowingCustomImageDialog,
    setIsShowingCustomImageDialog,
  ] = React.useState(false);

  const [tabIndex, setTabIndex] = React.useState(0);

  const [state, setState] = React.useState({
    ignoreIncomingLogs: false,
    building: false,
    buildRequestInProgress: false,
    cancelBuildRequestInProgress: false,
    environmentBuild: undefined,
    buildFetchHash: uuidv4(),
    customBaseImageName: "",
    languageDocsNotice: false,
  });

  const [promiseManager] = React.useState(new PromiseManager());

  const saveEnvironment = React.useCallback(
    async (payload?: Partial<Environment>) => {
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter.unload();

      try {
        const environmentUuidForUpdateOrCreate = environment.uuid || "new";
        const response = await fetcher<Environment>(
          `/store/environments/${projectUuid}/${environmentUuidForUpdateOrCreate}`,
          {
            method: isNewEnvironment ? "POST" : "PUT",
            headers: HEADER.JSON,
            body: JSON.stringify({
              environment: {
                ...environment,
                ...payload,
                uuid: environmentUuidForUpdateOrCreate,
              },
            }),
          }
        );

        if (isNewEnvironment) {
          // update the query arg environmentUuid
          navigateTo(siteMap.environment.path, {
            query: { projectUuid, environmentUuid: response.uuid },
          });
          return;
        }
        setEnvironment(response);
      } catch (error) {
        setAlert("Error", `Unable to save the custom image. ${error.message}`);
      }
      setIsShowingCustomImageDialog(false);
    },
    [
      environment,
      isNewEnvironment,
      navigateTo,
      projectUuid,
      setAlert,
      setEnvironment,
    ]
  );

  useAutoSaveEnvironment(
    !isFetchingEnvironment ? environment : null,
    saveEnvironment
  );

  const save = () => {
    // Saving an environment will invalidate the Jupyter <iframe>
    // TODO: perhaps this can be fixed with coordination between JLab +
    // Enterprise Gateway team.
    window.orchest.jupyter.unload();

    return makeCancelable<Environment>(
      new Promise((resolve, reject) => {
        if (!environment) {
          reject();
          return;
        }

        let method = isNewEnvironment ? "POST" : "PUT";
        let endpoint = `/store/environments/${projectUuid}/${environment.uuid}`;

        makeRequest(method, endpoint, {
          type: "json",
          content: { environment },
        })
          .then((response: string) => {
            let result: Environment = JSON.parse(response);

            environment.uuid = result.uuid;

            setEnvironment((prev) => ({ ...prev, uuid: result.uuid }));

            resolve(result);
          })
          .catch((error) => {
            console.log(error);

            try {
              console.error(JSON.parse(error.body)["message"]);
            } catch (error) {
              console.log(error);
              console.log("Couldn't get error message from response.");
            }

            reject();
          });
      }),
      promiseManager
    ).promise;
  };

  const onSave = (e: React.MouseEvent) => {
    if (!validEnvironmentName(environment.name)) {
      setAlert(
        "Error",
        'Double quotation marks in the "Environment name" have to be escaped using a backslash.'
      );
    } else {
      e.preventDefault();
      save();
    }
  };

  const returnToEnvironments = (e: React.MouseEvent) => {
    navigateTo(siteMap.environments.path, { query: { projectUuid } }, e);
  };

  const onChangeName = (value: string) => {
    setEnvironment((prev) => {
      return { ...prev, name: value };
    });
  };

  const onChangeBaseImage = (value: string) => {
    setEnvironment((prev) => ({ ...prev, base_image: value }));
  };

  const onChangeLanguage = (value: string) => {
    setEnvironment((prev) => ({ ...prev, language: value }));
  };

  const onCloseCustomBaseImageDialog = () => {
    setIsShowingCustomImageDialog(false);
  };

  const onOpenCustomBaseImageDialog = () => {
    setIsShowingCustomImageDialog(true);
  };

  const onSelectSubview = (e, index: number) => {
    setTabIndex(index);
  };

  const build = (e: React.MouseEvent) => {
    e.nativeEvent.preventDefault();

    setState((prevState) => ({
      ...prevState,
      buildRequestInProgress: true,
      ignoreIncomingLogs: true,
    }));

    save().then(() => {
      let buildPromise = makeCancelable(
        makeRequest("POST", "/catch/api-proxy/api/environment-builds", {
          type: "json",
          content: {
            environment_build_requests: [
              {
                environment_uuid: environment.uuid,
                project_uuid: projectUuid,
              },
            ],
          },
        }),
        promiseManager
      );

      buildPromise.promise
        .then((response) => {
          try {
            let environmentBuild: EnvironmentBuild = JSON.parse(response)[
              "environment_builds"
            ][0];

            onUpdateBuild(environmentBuild);
          } catch (error) {
            console.error(error);
          }
        })
        .catch((e) => {
          if (!e.isCanceled) {
            setState((prevState) => ({
              ...prevState,
              ignoreIncomingLogs: false,
            }));
            console.log(e);
          }
        })
        .finally(() => {
          setState((prevState) => ({
            ...prevState,
            buildRequestInProgress: false,
          }));
        });
    });
  };

  const cancelBuild = () => {
    // send DELETE to cancel ongoing build
    if (
      state.environmentBuild &&
      CANCELABLE_STATUSES.indexOf(state.environmentBuild.status) !== -1
    ) {
      setState((prevState) => ({
        ...prevState,
        cancelBuildRequestInProgress: true,
      }));

      makeRequest(
        "DELETE",
        `/catch/api-proxy/api/environment-builds/${state.environmentBuild.uuid}`
      )
        .then(() => {
          // immediately fetch latest status
          // NOTE: this DELETE call doesn't actually destroy the resource, that's
          // why we're querying it again.
          setState((prevState) => ({ ...prevState, buildFetchHash: uuidv4() }));
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          setState((prevState) => ({
            ...prevState,
            cancelBuildRequestInProgress: false,
          }));
        });
    } else {
      setAlert(
        "Error",
        "Could not cancel build, please try again in a few seconds."
      );
    }
  };

  const onBuildStart = () => {
    setState((prevState) => ({
      ...prevState,
      ignoreIncomingLogs: false,
    }));
  };

  const onUpdateBuild = (environmentBuild) => {
    setState((prevState) => ({
      ...prevState,
      building: CANCELABLE_STATUSES.indexOf(environmentBuild.status) !== -1,
      environmentBuild,
    }));
  };

  return (
    <Layout
      toolbarElements={
        <BackButton onClick={returnToEnvironments}>
          Back to environments
        </BackButton>
      }
    >
      {!environment ? (
        <LinearProgress />
      ) : (
        <>
          <CustomImageDialog
            isOpen={isShowingCustomImageDialog}
            onClose={onCloseCustomBaseImageDialog}
            initialValue={customImage}
            saveEnvironment={saveEnvironment}
            setCustomImage={setCustomImage}
          />
          <Box
            sx={{
              height: {
                xs: "auto",
                md: "100%",
              },
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
            }}
          >
            <Stack direction="column" spacing={3} sx={{ height: "100%" }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <TuneIcon />
                <PageTitle sx={{ textTransform: "uppercase" }}>
                  Environment properties
                </PageTitle>
              </Stack>
              <Paper
                elevation={3}
                sx={{
                  padding: (theme) => theme.spacing(3),
                  minWidth: (theme) => theme.spacing(48),
                  width: (theme) => ({ xs: "100%", md: theme.spacing(48) }),
                }}
              >
                <Stack direction="column" spacing={3}>
                  <TextField
                    fullWidth
                    autoFocus
                    required
                    label="Environment name"
                    onChange={(e) => onChangeName(e.target.value)}
                    value={environment.name}
                    data-test-id="environments-env-name"
                  />
                  <ContainerImagesRadioGroup
                    value={!isFetchingEnvironment && environment.base_image}
                    onChange={onChangeBaseImage}
                    customImage={customImage}
                    onOpenCustomBaseImageDialog={onOpenCustomBaseImageDialog}
                  />
                </Stack>
              </Paper>
            </Stack>
            <Box
              sx={{
                width: "100%",
                overflow: "hidden auto",
                paddingLeft: (theme) => ({
                  xs: theme.spacing(1),
                  md: theme.spacing(5),
                }),
                paddingRight: (theme) => ({
                  xs: theme.spacing(1),
                  md: theme.spacing(4),
                }),
                margin: (theme) => theme.spacing(-4, -4, -4, 0),
              }}
            >
              <Stack
                direction="column"
                spacing={3}
                sx={{
                  width: "100%",
                  marginRight: (theme) => theme.spacing(-4),
                  paddingBottom: (theme) => theme.spacing(4),
                }}
              >
                <Box sx={{ marginTop: (theme) => theme.spacing(10) }}>
                  <Typography component="h2" variant="h6">
                    Environment set-up script
                  </Typography>
                  <Typography variant="body2">
                    This will execute when you build the environment. Use it to
                    include your dependencies.
                  </Typography>
                </Box>
                <CodeMirror
                  value={environment.setup_script}
                  options={{
                    mode: "application/x-sh",
                    theme: "dracula",
                    lineNumbers: true,
                    viewportMargin: Infinity,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    setEnvironment((prev) => ({
                      ...prev,
                      setup_script: value,
                    }));
                  }}
                />
                {environment && !isNewEnvironment && (
                  <ImageBuildLog
                    buildFetchHash={state.buildFetchHash}
                    buildRequestEndpoint={`/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}/${environment.uuid}`}
                    buildsKey="environment_builds"
                    socketIONamespace={
                      config.ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE
                    }
                    streamIdentity={projectUuid + "-" + environment.uuid}
                    onUpdateBuild={onUpdateBuild}
                    onBuildStart={onBuildStart}
                    ignoreIncomingLogs={state.ignoreIncomingLogs}
                    build={state.environmentBuild}
                    building={state.building}
                  />
                )}
              </Stack>
            </Box>
          </Box>
          {false && (
            <>
              <Grid container spacing={4}>
                <Grid item sm={12} md="auto"></Grid>
                <Grid item sm={12} md>
                  <Paper
                    elevation={3}
                    sx={{ padding: (theme) => theme.spacing(3) }}
                  ></Paper>
                </Grid>
              </Grid>

              <div className="push-down-7" style={{ marginTop: "200px" }}>
                <Tabs
                  value={tabIndex}
                  onChange={onSelectSubview}
                  label="environment-tabs"
                  data-test-id="environments"
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
              </div>
              <TabPanel value={tabIndex} index={0} name="properties">
                <Stack
                  direction="column"
                  spacing={2}
                  alignItems="flex-start"
                  maxWidth={(theme) => theme.spacing(80)}
                  marginBottom={(theme) => theme.spacing(4)}
                >
                  {/* <TextField
                  fullWidth
                  label="Environment name"
                  onChange={(e) => onChangeName(e.target.value)}
                  value={environment.name}
                  data-test-id="environments-env-name"
                /> */}
                  <Stack
                    direction="row"
                    sx={{ width: "100%" }}
                    alignItems="center"
                    spacing={2}
                  >
                    <FormControl fullWidth>
                      <InputLabel id="select-base-image-label">
                        Base image
                      </InputLabel>
                      <Select
                        labelId="select-base-image-label"
                        id="select-base-image"
                        value={environment.base_image}
                        label="Base image"
                        onChange={(e) => onChangeBaseImage(e.target.value)}
                      >
                        {DEFAULT_BASE_IMAGES.map((image) => {
                          return (
                            <MenuItem key={image} value={image}>
                              {image}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                    <Button
                      startIcon={<AddIcon />}
                      color="secondary"
                      onClick={onOpenCustomBaseImageDialog}
                      sx={{ minWidth: (theme) => theme.spacing(20) }}
                    >
                      Custom image
                    </Button>
                  </Stack>
                  <div className="form-helper-text push-down-7">
                    The base image will be the starting point from which the
                    environment will be built.
                  </div>

                  <FormControl fullWidth>
                    <InputLabel id="select-language-label">Language</InputLabel>
                    <Select
                      labelId="select-language-label"
                      id="select-language"
                      value={environment.language}
                      label="Base image"
                      onChange={(e) => onChangeLanguage(e.target.value)}
                    >
                      {Object.entries(LANGUAGE_MAP).map(([value, label]) => {
                        return (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>

                  <div className="form-helper-text push-down-7">
                    The language determines for which kernel language this
                    environment can be used. This only affects pipeline steps
                    that point to a Notebook.
                  </div>

                  {state.languageDocsNotice === true && (
                    <div className="docs-notice push-down-7">
                      Language explanation
                    </div>
                  )}

                  {/* <FormGroup>
                  <FormControlLabel
                    label="GPU support"
                    data-test-id="pipeline-settings-configuration-memory-eviction"
                    control={
                      <Checkbox
                        checked={environment.gpu_support}
                        onChange={(e) => {
                          onGPUChange(e.target.checked);
                        }}
                      />
                    }
                  />
                </FormGroup> */}

                  {/* {(() => {
                  if (environment.gpu_support === true) {
                    let enabledBlock = (
                      <p className="push-down-7">
                        If enabled, the environment will request GPU
                        capabilities when in use.
                      </p>
                    );
                    if (config.GPU_ENABLED_INSTANCE !== true) {
                      if (config.CLOUD === true) {
                        return (
                          <div className="docs-notice push-down-7">
                            <p>
                              This instance is not configured with a GPU. Change
                              the instance type to a GPU enabled one if you need
                              GPU pass-through. Steps using this environment
                              will work regardless, but no GPU pass-through will
                              take place.
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="docs-notice push-down-7">
                            {enabledBlock}
                            <p>
                              Could not detect a GPU. Check out{" "}
                              <a
                                target="_blank"
                                href={
                                  config.ORCHEST_WEB_URLS.readthedocs +
                                  "/getting_started/installation.html#gpu-support"
                                }
                                rel="noreferrer"
                              >
                                the documentation
                              </a>{" "}
                              to make sure Orchest is properly configured for
                              environments with GPU support. In particular, make
                              sure the selected base image supports GPU pass
                              through. Steps using this environment will work
                              regardless, but no GPU pass-through will take
                              place.
                            </p>
                          </div>
                        );
                      }
                    } else {
                      return (
                        <div className="docs-notice push-down-7">
                          {enabledBlock}
                        </div>
                      );
                    }
                  }
                })()} */}
                </Stack>
              </TabPanel>
              <TabPanel value={tabIndex} index={1} name="build">
                <h3>Environment set-up script</h3>
                <div className="form-helper-text push-down-7">
                  This will execute when you build the environment. Use it to
                  include your dependencies.
                </div>
                <div className="push-down-7">
                  <CodeMirror
                    value={environment.setup_script}
                    options={{
                      mode: "application/x-sh",
                      theme: "jupyter",
                      lineNumbers: true,
                      viewportMargin: Infinity,
                    }}
                    onBeforeChange={(editor, data, value) => {
                      setEnvironment((prev) => ({
                        ...prev,
                        setup_script: value,
                      }));
                    }}
                  />
                </div>
                {environment && !isNewEnvironment && (
                  <ImageBuildLog
                    buildFetchHash={state.buildFetchHash}
                    buildRequestEndpoint={`/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}/${environment.uuid}`}
                    buildsKey="environment_builds"
                    socketIONamespace={
                      config.ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE
                    }
                    streamIdentity={projectUuid + "-" + environment.uuid}
                    onUpdateBuild={onUpdateBuild}
                    onBuildStart={onBuildStart}
                    ignoreIncomingLogs={state.ignoreIncomingLogs}
                    build={state.environmentBuild}
                    building={state.building}
                  />
                )}
              </TabPanel>
              <Stack
                spacing={2}
                direction="row"
                sx={{ padding: (theme) => theme.spacing(1) }}
              >
                <Button
                  variant="contained"
                  onClick={onSave}
                  startIcon={<SaveIcon />}
                  data-test-id="environments-save"
                >
                  {hasUnsavedChanges ? "Save*" : "Save"}
                </Button>
                {tabIndex === 1 &&
                  !isNewEnvironment &&
                  (!state.building ? (
                    <Button
                      disabled={state.buildRequestInProgress}
                      variant="contained"
                      color="secondary"
                      onClick={build}
                      startIcon={<MemoryIcon />}
                      data-test-id="environment-start-build"
                    >
                      Build
                    </Button>
                  ) : (
                    <Button
                      disabled={state.cancelBuildRequestInProgress}
                      variant="contained"
                      color="secondary"
                      onClick={cancelBuild}
                      startIcon={<CloseIcon />}
                      data-test-id="environments-cancel-build"
                    >
                      Cancel build
                    </Button>
                  ))}
              </Stack>
            </>
          )}
        </>
      )}
    </Layout>
  );
};

export default EnvironmentEditView;
