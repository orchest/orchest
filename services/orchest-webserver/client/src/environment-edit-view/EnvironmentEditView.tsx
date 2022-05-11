import { BackButton } from "@/components/common/BackButton";
import { HotKeyHint } from "@/components/common/HotKeyHint";
import { PageTitle } from "@/components/common/PageTitle";
import { ImageBuildLog } from "@/components/ImageBuildLog";
import { ImageBuildStatus } from "@/components/ImageBuildStatus";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useFetchEnvironment } from "@/hooks/useFetchEnvironment";
import { useHotKeys } from "@/hooks/useHotKeys";
import { useMounted } from "@/hooks/useMounted";
import { useSendAnalyticEvent } from "@/hooks/useSendAnalyticEvent";
import { siteMap } from "@/routingConfig";
import type { CustomImage, Environment, EnvironmentImageBuild } from "@/types";
import CloseIcon from "@mui/icons-material/Close";
import MemoryIcon from "@mui/icons-material/Memory";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetcher, hasValue, HEADER, uuidv4 } from "@orchest/lib-utils";
import "codemirror/mode/shell/shell";
import "codemirror/theme/dracula.css";
import { useFormik } from "formik";
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { ContainerImagesRadioGroup } from "./ContainerImagesRadioGroup";
import { CustomImageDialog } from "./CustomImageDialog";
import { useAutoSaveEnvironment } from "./useAutoSaveEnvironment";
import { useRequestEnvironmentImageBuild } from "./useRequestEnvironmentImageBuild";

const CANCELABLE_STATUSES = ["PENDING", "STARTED"];

const DOUBLE_QUOTATION_MARK_ERROR =
  'Please escape double quotation marks using a "\\".';
const validateEnvironmentName = (name: string | undefined) => {
  if (name === undefined) return { valid: false, reason: "" };
  if (!name || !/\S/.test(name)) {
    return { valid: false, reason: "Cannot be blank" };
  }
  // Negative lookbehind. Check that every " is escaped with \
  for (let x = 0; x < name.length; x++) {
    if (name[x] === '"' && (x == 0 || name[x - 1] != "\\"))
      return { valid: false, reason: DOUBLE_QUOTATION_MARK_ERROR };
  }
  return { valid: true };
};

/**
 * in this view we use auto-save with a debounced time
 * so we still need setAsSaved to ensure that user's change is saved
 */

const ENVIRONMENT_BUILDS_BASE_ENDPOINT =
  "/catch/api-proxy/api/environment-builds";

const EnvironmentEditView: React.FC = () => {
  // global states
  const { setAlert, setAsSaved, config } = useAppContext();

  useSendAnalyticEvent("view load", { name: siteMap.environment.path });

  // data from route
  const { projectUuid, environmentUuid, navigateTo } = useCustomRoute();

  const returnToEnvironments = React.useCallback(
    (e?: React.MouseEvent) => {
      navigateTo(siteMap.environments.path, { query: { projectUuid } }, e);
    },
    [navigateTo, projectUuid]
  );

  // local states
  const {
    environment,
    setEnvironment,
    isFetchingEnvironment,
    customImage,
    setCustomImage,
    error: fetchEnvironmentError,
  } = useFetchEnvironment({
    // if environment is new, don't pass the uuid, so this hook won't fire the request
    uuid: environmentUuid,
    project_uuid: projectUuid,
    ...config?.ENVIRONMENT_DEFAULTS,
  });

  // !Note: new environment should have been created in EnvironmentList
  // if user tweak the query args by changing it to "new", we send user back to EnvironmentList
  // if failed to fetch environment, environment is probably removed
  React.useEffect(() => {
    if (
      !projectUuid ||
      !environmentUuid ||
      environmentUuid === "new" ||
      (!isFetchingEnvironment && fetchEnvironmentError)
    ) {
      setAlert(
        "Error",
        "Environment does not exist. It could have been removed.",
        (resolve) => {
          resolve(true);
          returnToEnvironments();
          return true;
        }
      );
    }
  }, [
    isFetchingEnvironment,
    returnToEnvironments,
    projectUuid,
    environmentUuid,
    fetchEnvironmentError,
    setAlert,
  ]);

  const [
    isShowingCustomImageDialog,
    setIsShowingCustomImageDialog,
  ] = React.useState(false);

  const [ignoreIncomingLogs, setIgnoreIncomingLogs] = React.useState(false);

  const [environmentBuild, setEnvironmentImageBuild] = React.useState<
    EnvironmentImageBuild | undefined
  >(undefined);
  const building = React.useMemo(() => {
    return (
      ignoreIncomingLogs ||
      CANCELABLE_STATUSES.includes(environmentBuild?.status || "")
    );
  }, [environmentBuild, ignoreIncomingLogs]);

  const [isCancellingBuild, setIsCancellingBuild] = React.useState(false);

  const [buildFetchHash, setBuildFetchHash] = React.useState(uuidv4());

  const environmentNameValidation = validateEnvironmentName(environment?.name);

  const saveEnvironment = React.useCallback(
    async (payload?: Partial<Environment>) => {
      if (!environmentNameValidation.valid) {
        return null;
      }
      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();

      try {
        const environmentUuidForUpdateOrCreate = environment?.uuid || "new";
        const response = await fetcher<Environment>(
          `/store/environments/${projectUuid}/${environmentUuidForUpdateOrCreate}`,
          {
            method: "PUT",
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

        setAsSaved();
        return response;
      } catch (error) {
        setAlert("Error", `Unable to save the custom image. ${error.message}`);
        setAsSaved(false);
        return null;
      }
    },
    [environment, setAsSaved, projectUuid, setAlert, environmentNameValidation]
  );

  const {
    handleSubmit,
    handleBlur,
    values,
    setFieldValue,
    submitForm,
  } = useFormik({
    initialValues: environment || { name: "" },
    isInitialValid: false,
    validate: ({ name }) => {
      const errors: Record<string, string> = {};
      const environmentNameValidation = validateEnvironmentName(name);
      if (!environmentNameValidation.valid)
        errors.name = environmentNameValidation.reason || "";
      return errors;
    },
    onSubmit: async (payload, { setSubmitting }) => {
      setSubmitting(true);
      const outcome = await saveEnvironment(payload);
      setAsSaved(hasValue(outcome));
      setSubmitting(false);
    },
    enableReinitialize: true,
  });

  useAutoSaveEnvironment(environment, submitForm);

  const onChangeEnvironment = React.useCallback(
    (payload: Partial<Environment>) => {
      Object.entries(payload).forEach(([key, value]) => {
        setFieldValue(key, value);
      });
      setAsSaved(false);
      setEnvironment((prev) => ({ ...prev, ...payload } as Environment));
    },
    [setAsSaved, setEnvironment, setFieldValue]
  );

  const setCustomImageInEnvironment = (updatedCustomImage: CustomImage) => {
    setCustomImage(updatedCustomImage);
    onChangeEnvironment(updatedCustomImage);
  };

  const onCloseCustomBaseImageDialog = () => {
    setIsShowingCustomImageDialog(false);
  };

  const onOpenCustomBaseImageDialog = () => {
    setIsShowingCustomImageDialog(true);
  };

  const {
    isRequestingToBuild,
    newEnvironmentImageBuild,
    requestBuildError,
    requestToBuild,
  } = useRequestEnvironmentImageBuild(ENVIRONMENT_BUILDS_BASE_ENDPOINT);

  const build = React.useCallback(
    async (e?: React.MouseEvent) => {
      if (building || !projectUuid) return;
      if (e) {
        e.preventDefault();
        e.nativeEvent.preventDefault();
      }

      setIgnoreIncomingLogs(true);

      const outcome = await saveEnvironment();

      if (!hasValue(outcome) || !environment) return;

      await requestToBuild(projectUuid, environment?.uuid);
      setIgnoreIncomingLogs(false);
    },
    [building, environment, projectUuid, requestToBuild, saveEnvironment]
  );

  useHotKeys({
    all: {
      "ctrl+enter, command+enter": (e, hotKeyEvent) => {
        if (["ctrl+enter", "command+enter"].includes(hotKeyEvent.key)) {
          e.preventDefault();
          build();
        }
      },
    },
  });

  React.useEffect(() => {
    if (newEnvironmentImageBuild) {
      setEnvironmentImageBuild(newEnvironmentImageBuild);
    }
  }, [newEnvironmentImageBuild]);
  React.useEffect(() => {
    if (requestBuildError) {
      setIgnoreIncomingLogs(false);
    }
  }, [requestBuildError]);

  const mounted = useMounted();

  const cancelBuild = () => {
    // send DELETE to cancel ongoing build
    if (
      environmentBuild &&
      CANCELABLE_STATUSES.includes(environmentBuild.status)
    ) {
      setIsCancellingBuild(true);

      fetcher(
        `${ENVIRONMENT_BUILDS_BASE_ENDPOINT}/${environmentBuild.project_uuid}/` +
          `${environmentBuild.environment_uuid}/${environmentBuild.image_tag}`,
        { method: "DELETE" }
      )
        .then(() => {
          // immediately fetch latest status
          // NOTE: this DELETE call doesn't actually destroy the resource, that's
          // why we're querying it again.
          setBuildFetchHash(uuidv4());
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          if (mounted.current) setIsCancellingBuild(false);
        });
    } else {
      setAlert(
        "Error",
        "Could not cancel build, please try again in a few seconds."
      );
    }
  };

  return (
    <Layout
      toolbarElements={
        <BackButton onClick={returnToEnvironments}>
          Back to environments
        </BackButton>
      }
      loading={isFetchingEnvironment}
    >
      {!isFetchingEnvironment && (
        <>
          <CustomImageDialog
            isOpen={isShowingCustomImageDialog}
            onClose={onCloseCustomBaseImageDialog}
            initialValue={customImage}
            saveEnvironment={saveEnvironment}
            setCustomImage={setCustomImageInEnvironment}
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
            <form
              id="environment-edit-form"
              onSubmit={handleSubmit}
              style={{ height: "100%" }}
            >
              <Stack direction="column" spacing={3}>
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
                      error={!environmentNameValidation.valid}
                      helperText={environmentNameValidation.reason || " "}
                      disabled={building}
                      onChange={(e) =>
                        onChangeEnvironment({ name: e.target.value })
                      }
                      onBlur={handleBlur}
                      value={values.name || ""}
                      data-test-id="environments-env-name"
                    />
                    <ContainerImagesRadioGroup
                      disabled={building}
                      value={!isFetchingEnvironment && environment?.base_image}
                      onChange={onChangeEnvironment}
                      customImage={customImage}
                      onOpenCustomBaseImageDialog={onOpenCustomBaseImageDialog}
                    />
                  </Stack>
                </Paper>
              </Stack>
            </form>
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
                    Add dependencies to your environment.
                  </Typography>
                </Box>
                <CodeMirror
                  value={environment?.setup_script || ""}
                  options={{
                    mode: "application/x-sh",
                    theme: "dracula",
                    lineNumbers: true,
                    viewportMargin: Infinity,
                    readOnly: building,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    onChangeEnvironment({ setup_script: value });
                  }}
                />
                <Stack direction="row" spacing={3} alignItems="center">
                  <HotKeyHint hint="enter" disabled={building}>
                    <Button
                      disabled={isRequestingToBuild || isCancellingBuild}
                      variant="contained"
                      color={!building ? "primary" : "secondary"}
                      onClick={!building ? build : cancelBuild}
                      startIcon={!building ? <MemoryIcon /> : <CloseIcon />}
                      data-test-id={
                        !building
                          ? "environment-start-build"
                          : "environments-cancel-build"
                      }
                      sx={{
                        width: (theme) => theme.spacing(28),
                        padding: (theme) => theme.spacing(1, 4),
                      }}
                    >
                      {!building ? "Build" : "Cancel build"}
                    </Button>
                  </HotKeyHint>
                  <ImageBuildStatus build={environmentBuild} sx={{ flex: 1 }} />
                </Stack>
                {environment && (
                  <ImageBuildLog
                    hideDefaultStatus
                    buildRequestEndpoint={`${ENVIRONMENT_BUILDS_BASE_ENDPOINT}/most-recent/${projectUuid}/${environment?.uuid}`}
                    buildsKey="environment_image_builds"
                    socketIONamespace={
                      config?.ORCHEST_SOCKETIO_ENV_IMG_BUILDING_NAMESPACE
                    }
                    streamIdentity={`${projectUuid}-${environment?.uuid}`}
                    onUpdateBuild={setEnvironmentImageBuild}
                    ignoreIncomingLogs={ignoreIncomingLogs}
                    build={environmentBuild}
                    buildFetchHash={buildFetchHash}
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
