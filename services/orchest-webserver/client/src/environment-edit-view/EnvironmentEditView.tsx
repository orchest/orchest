import { BackButton } from "@/components/common/BackButton";
import { PageTitle } from "@/components/common/PageTitle";
import ImageBuildLog from "@/components/ImageBuildLog";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironment } from "@/hooks/useFetchEnvironment";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/Routes";
import type { CustomImage, Environment, EnvironmentBuild } from "@/types";
import CloseIcon from "@mui/icons-material/Close";
import MemoryIcon from "@mui/icons-material/Memory";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  fetcher,
  hasValue,
  HEADER,
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
 * in this view we use auto-save with a debounced time
 * so we still need setAsSaved to ensure that user's change is saved
 */

const EnvironmentEditView: React.FC = () => {
  // global states
  const {
    setAlert,
    setAsSaved,
    state: { config },
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

  const environmentNameError = !validEnvironmentName(environment.name)
    ? 'Double quotation marks in the "Environment name" have to be escaped using a backslash.'
    : undefined;

  const saveEnvironment = React.useCallback(
    async (payload?: Partial<Environment>) => {
      if (environmentNameError) {
        return false;
      }
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
          setAsSaved();
          // update the query arg environmentUuid
          navigateTo(siteMap.environment.path, {
            query: { projectUuid, environmentUuid: response.uuid },
          });
          return true;
        }
        setEnvironment(response);
        setAsSaved();
        return true;
      } catch (error) {
        setAlert("Error", `Unable to save the custom image. ${error.message}`);
        setAsSaved(false);
        return false;
      }
    },
    [
      environment,
      isNewEnvironment,
      navigateTo,
      setAsSaved,
      projectUuid,
      setAlert,
      setEnvironment,
      environmentNameError,
    ]
  );

  useAutoSaveEnvironment(
    !isFetchingEnvironment ? environment : null,
    saveEnvironment
  );

  const returnToEnvironments = (e: React.MouseEvent) => {
    navigateTo(siteMap.environments.path, { query: { projectUuid } }, e);
  };

  const onChangeName = (value: string) => {
    setAsSaved(false);
    setEnvironment((prev) => {
      return { ...prev, name: value };
    });
  };

  const onChangeBaseImage = (newImage: CustomImage) => {
    setAsSaved(false);
    setEnvironment((prev) => ({ ...prev, ...newImage }));
  };

  const onCloseCustomBaseImageDialog = () => {
    setIsShowingCustomImageDialog(false);
  };

  const onOpenCustomBaseImageDialog = () => {
    setIsShowingCustomImageDialog(true);
  };

  const build = async (e: React.MouseEvent) => {
    e.nativeEvent.preventDefault();

    setState((prevState) => ({
      ...prevState,
      buildRequestInProgress: true,
      ignoreIncomingLogs: true,
    }));

    const success = await saveEnvironment();

    if (!success) return;

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
                    error={hasValue(environmentNameError)}
                    helperText={environmentNameError}
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
                <Stack direction="row">
                  {!isNewEnvironment &&
                    (!state.building ? (
                      <Button
                        disabled={state.buildRequestInProgress}
                        variant="contained"
                        color="primary"
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
                        color="primary"
                        onClick={cancelBuild}
                        startIcon={<CloseIcon />}
                        data-test-id="environments-cancel-build"
                      >
                        Cancel build
                      </Button>
                    ))}
                  {state.building && <LinearProgress />}
                </Stack>
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
        </>
      )}
    </Layout>
  );
};

export default EnvironmentEditView;
