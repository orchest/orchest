import { BackButton } from "@/components/common/BackButton";
import { HotKeyHint } from "@/components/common/HotKeyHint";
import { PageTitle } from "@/components/common/PageTitle";
import { ImageBuildLog } from "@/components/ImageBuildLog";
import { ImageBuildStatus } from "@/components/ImageBuildStatus";
import { Layout } from "@/components/Layout";
import { useAppContext } from "@/contexts/AppContext";
import { useGlobalContext } from "@/contexts/GlobalContext";
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
import React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import { EnvironmentImagesRadioGroup } from "../environments-view/edit-environment/EnvironmentImagesRadioGroup";
import { DEFAULT_BASE_IMAGES } from "./common";
import { CustomImageDialog } from "./CustomImageDialog";
import { useAutoSaveEnvironment } from "./useAutoSaveEnvironment";
import { useCustomImage } from "./useCustomImage";
import { useRequestEnvironmentImageBuild } from "./useRequestEnvironmentImageBuild";

const canCancel = (status = "NONE") => ["PENDING", "STARTED"].includes(status);

const validateEnvironmentName = (name: string | undefined) => {
  if (!name || !/\S/.test(name)) {
    return { valid: false, reason: "Cannot be blank" };
  }

  // Negative lookbehind. Check that every " is escaped with \
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '"' && (i === 0 || name[i - 1] !== "\\"))
      return {
        valid: false,
        reason: 'Please escape double quotation marks using "\\".',
      };
  }

  return { valid: true };
};

const ENVIRONMENT_BUILDS_BASE_ENDPOINT =
  "/catch/api-proxy/api/environment-builds";

const EnvironmentEditView: React.FC = () => {
  // In this view we do a debounced auto-save
  // so we still need setAsSaved to ensure that user's change is saved

  const { setAlert, setAsSaved, config } = useGlobalContext();
  const { orchestVersion } = useAppContext();

  useSendAnalyticEvent("view:loaded", { name: siteMap.environment.path });

  const { projectUuid, environmentUuid, navigateTo } = useCustomRoute();

  const returnToEnvironments = React.useCallback(
    (e?: React.MouseEvent) =>
      navigateTo(siteMap.environments.path, { query: { projectUuid } }, e),
    [navigateTo, projectUuid]
  );

  const {
    environment,
    setEnvironment,
    isFetchingEnvironment,
    error: fetchEnvironmentError,
  } = useFetchEnvironment(
    environmentUuid === "new" // if environmentUuid is "new", no need to fetch data.
      ? undefined
      : { projectUuid, environmentUuid }
  );

  const defaultImageInUse = React.useMemo(() => {
    return environment?.base_image
      ? DEFAULT_BASE_IMAGES.find((image) => {
          const versionedImage = `${image.base_image}:${orchestVersion}`;
          return [versionedImage, image.base_image].includes(
            environment.base_image
          );
        })
      : undefined;
  }, [environment?.base_image, orchestVersion]);

  const [customImage, setCustomImage] = useCustomImage(
    environment,
    defaultImageInUse,
    orchestVersion
  );

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
    return ignoreIncomingLogs || canCancel(environmentBuild?.status || "");
  }, [environmentBuild, ignoreIncomingLogs]);

  const [isCancellingBuild, setIsCancellingBuild] = React.useState(false);

  const [buildFetchHash, setBuildFetchHash] = React.useState(uuidv4());

  const environmentNameValidation = validateEnvironmentName(environment?.name);

  const saveEnvironment = React.useCallback(
    async (payload?: Partial<Environment>) => {
      if (!environmentNameValidation.valid || !environment?.uuid) {
        throw new Error("The environment information is not valid");
      }

      // Saving an environment will invalidate the Jupyter <iframe>
      // TODO: perhaps this can be fixed with coordination between JLab +
      // Enterprise Gateway team.
      window.orchest.jupyter?.unload();

      try {
        const response = await fetcher<Environment>(
          `/store/environments/${projectUuid}/${environment.uuid}`,
          {
            method: "PUT",
            headers: HEADER.JSON,
            body: JSON.stringify({
              environment: {
                ...environment,
                ...payload,
                uuid: environment.uuid,
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

  useAutoSaveEnvironment(environment, saveEnvironment);

  const onChangeEnvironment = React.useCallback(
    (payload: Partial<Environment>) => {
      setAsSaved(false);
      setEnvironment((prev) => ({ ...prev, ...payload } as Environment));
    },
    [setAsSaved, setEnvironment]
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

      e?.preventDefault();
      e?.nativeEvent.preventDefault();

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
    if (environmentBuild && canCancel(environmentBuild.status)) {
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
        .catch((error) => console.error(error))
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

  const selectedImage = !isFetchingEnvironment
    ? defaultImageInUse?.base_image || environment?.base_image
    : undefined;

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
              height: { xs: "auto", md: "100%" },
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
            }}
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
                    label="Environment name"
                    value={environment?.name || ""}
                    onChange={(event) =>
                      onChangeEnvironment({ name: event.target.value })
                    }
                    fullWidth
                    autoFocus
                    required
                    error={!environmentNameValidation.valid}
                    helperText={environmentNameValidation.reason || " "}
                    disabled={building}
                    data-test-id="environments-env-name"
                  />
                  <EnvironmentImagesRadioGroup
                    disabled={building}
                    orchestVersion={orchestVersion}
                    value={selectedImage}
                    onChange={onChangeEnvironment}
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
                    Add dependencies to your environment.
                  </Typography>
                </Box>
                <CodeMirror
                  value={environment?.setup_script || ""}
                  onBeforeChange={(_, __, value) =>
                    onChangeEnvironment({ setup_script: value })
                  }
                  options={{
                    mode: "application/x-sh",
                    theme: "dracula",
                    lineNumbers: true,
                    viewportMargin: Infinity,
                    readOnly: building,
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
