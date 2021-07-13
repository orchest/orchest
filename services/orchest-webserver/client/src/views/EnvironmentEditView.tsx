import * as React from "react";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/shell/shell";
import { uuidv4 } from "@orchest/lib-utils";
import {
  MDCButtonReact,
  MDCTextFieldReact,
  MDCSelectReact,
  MDCCheckboxReact,
  MDCTabBarReact,
  MDCDialogReact,
  MDCLinearProgressReact,
} from "@orchest/lib-mdc";
import {
  makeRequest,
  PromiseManager,
  makeCancelable,
  RefManager,
  LANGUAGE_MAP,
  DEFAULT_BASE_IMAGES,
} from "@orchest/lib-utils";
import { useOrchest } from "@/hooks/orchest";
import { Layout } from "@/components/Layout";
import ImageBuildLog from "@/components/ImageBuildLog";
import EnvironmentsView from "@/views/EnvironmentsView";

const CANCELABLE_STATUSES = ["PENDING", "STARTED"];

const EnvironmentEditView: React.FC<any> = (props) => {
  const { orchest } = window;

  const context = useOrchest();

  const [state, setState] = React.useState({
    addCustomBaseImageDialog: null,
    subviewIndex: 0,
    baseImages: [...DEFAULT_BASE_IMAGES],
    newEnvironment: props.queryArgs.environment_uuid === undefined,
    unsavedChanges: !props.queryArgs.environment_uuid,
    environment: !props.queryArgs.environment_uuid
      ? {
          uuid: "new",
          name: context.state?.config?.ENVIRONMENT_DEFAULTS.name,
          gpu_support: context.state?.config?.ENVIRONMENT_DEFAULTS.gpu_support,
          project_uuid: props.queryArgs.project_uuid,
          base_image: context.state?.config?.ENVIRONMENT_DEFAULTS.base_image,
          language: context.state?.config?.ENVIRONMENT_DEFAULTS.language,
          setup_script:
            context.state?.config?.ENVIRONMENT_DEFAULTS.setup_script,
        }
      : undefined,
    ignoreIncomingLogs: false,
    building: false,
    buildRequestInProgress: false,
    cancelBuildRequestInProgress: false,
    environmentBuild: undefined,
    buildFetchHash: uuidv4(),
    customBaseImageName: "",
    languageDocsNotice: false,
  });

  const [refManager] = React.useState(new RefManager());
  const [promiseManager] = React.useState(new PromiseManager());

  const fetchEnvironment = () => {
    let endpoint = `/store/environments/${props.queryArgs.project_uuid}/${props.queryArgs.environment_uuid}`;

    let cancelableRequest = makeCancelable(
      makeRequest("GET", endpoint),
      promiseManager
    );

    cancelableRequest.promise
      .then((response) => {
        let environment = JSON.parse(response);

        setState((prevState) => ({
          ...prevState,
          environment: environment,
          baseImages:
            DEFAULT_BASE_IMAGES.indexOf(environment.base_image) == -1
              ? DEFAULT_BASE_IMAGES.concat(environment.base_image)
              : [...DEFAULT_BASE_IMAGES],
        }));
      })

      .catch((error) => {
        console.error(error);
      });
  };

  const save = () => {
    // Saving an environment will invalidate the Jupyter <iframe>
    // TODO: perhaps this can be fixed with coordination between JLab +
    // Enterprise Gateway team.
    orchest.jupyter.unload();

    return makeCancelable(
      new Promise((resolve, reject) => {
        let method = "POST";
        let endpoint = `/store/environments/${state.environment.project_uuid}/${state.environment.uuid}`;

        if (state.newEnvironment === false) {
          method = "PUT";
        }

        makeRequest(method, endpoint, {
          type: "json",
          content: {
            environment: state.environment,
          },
        })
          .then((response: string) => {
            let result = JSON.parse(response);

            state.environment.uuid = result.uuid;

            setState((prevState) => ({
              ...prevState,
              environment: state.environment,
              newEnvironment: false,
              unsavedChanges: false,
            }));

            resolve(undefined);
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

  const onSave = (e) => {
    const validEnvironmentName = (name) => {
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

    if (!validEnvironmentName(state.environment.name)) {
      orchest.alert(
        "Error",
        'Double quotation marks in the "Environment name" have to be escaped using a backslash.'
      );
    } else {
      e.preventDefault();
      save();
    }
  };

  const returnToEnvironments = () => {
    context.dispatch({
      type: "projectSet",
      payload: props.queryArgs.project_uuid,
    });
    orchest.loadView(EnvironmentsView);
  };

  const onChangeName = (value) =>
    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      environment: {
        ...prevState.environment,
        name: value,
      },
    }));

  const onChangeBaseImage = (value) =>
    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      environment: {
        ...prevState.environment,
        base_image: value,
      },
    }));

  const onChangeLanguage = (value) =>
    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      environment: {
        ...prevState.environment,
        language: value,
      },
    }));

  const onGPUChange = (is_checked) =>
    setState((prevState) => ({
      ...prevState,
      unsavedChanges: true,
      environment: {
        ...prevState.environment,
        gpu_support: is_checked,
      },
    }));

  const onCancelAddCustomBaseImageDialog = () => {
    refManager.refs.addCustomBaseImageDialog.close();
  };

  const onCloseAddCustomBaseImageDialog = () =>
    setState((prevState) => ({
      ...prevState,
      addCustomBaseImageDialog: undefined,
    }));

  const submitAddCustomBaseImage = () => {
    setState((prevState) => ({
      ...prevState,
      customBaseImageName: "",
      baseImages:
        prevState.baseImages.indexOf(prevState.customBaseImageName) == -1
          ? prevState.baseImages.concat(prevState.customBaseImageName)
          : prevState.baseImages,
      environment: {
        ...prevState.environment,
        base_image: prevState.customBaseImageName,
      },
      unsavedChanges: true,
      addCustomBaseImageDialog: undefined,
    }));
  };

  const onAddCustomBaseImage = () => {
    setState((prevState) => ({
      ...prevState,
      addCustomBaseImageDialog: (
        <MDCDialogReact
          title="Add custom base image"
          ref={refManager.nrefs.addCustomBaseImageDialog}
          onClose={onCloseAddCustomBaseImageDialog.bind(this)}
          content={
            <div>
              <MDCTextFieldReact
                label="Base image name"
                value={state.customBaseImageName}
                onChange={(value) =>
                  setState((nestedPrevState) => ({
                    ...nestedPrevState,
                    customBaseImageName: value,
                  }))
                }
              />
            </div>
          }
          actions={
            <React.Fragment>
              <MDCButtonReact
                classNames={["push-right"]}
                label="Cancel"
                onClick={onCancelAddCustomBaseImageDialog.bind(this)}
              />
              <MDCButtonReact
                label="Add"
                icon="check"
                classNames={["mdc-button--raised"]}
                submitButton
                onClick={submitAddCustomBaseImage.bind(this)}
              />
            </React.Fragment>
          }
        />
      ),
    }));
  };

  const onSelectSubview = (index) => {
    setState((prevState) => ({
      ...prevState,
      subviewIndex: index,
    }));
  };

  const build = (e) => {
    e.nativeEvent.preventDefault();
    refManager.refs.tabBar.tabBar.activateTab(1);

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
                environment_uuid: state.environment.uuid,
                project_uuid: state.environment.project_uuid,
              },
            ],
          },
        }),
        promiseManager
      );

      buildPromise.promise
        .then((response) => {
          try {
            let environmentBuild = JSON.parse(response)[
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
      orchest.alert(
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

  React.useEffect(() => {
    if (props.queryArgs.environment_uuid) fetchEnvironment();

    return () => promiseManager.cancelCancelablePromises();
  }, []);

  React.useEffect(() => {
    context.dispatch({
      type: "setUnsavedChanges",
      payload: state.unsavedChanges,
    });
  }, [state.unsavedChanges]);

  return (
    <Layout>
      <div className={"view-page edit-environment"}>
        {!state.environment ? (
          <MDCLinearProgressReact />
        ) : (
          <>
            {state.addCustomBaseImageDialog && state.addCustomBaseImageDialog}

            <div className="push-down">
              <MDCButtonReact
                label="Back to environments"
                icon="arrow_back"
                onClick={returnToEnvironments.bind(this)}
              />
            </div>

            <div className="push-down-7">
              <MDCTabBarReact
                ref={refManager.nrefs.tabBar}
                selectedIndex={state.subviewIndex}
                items={["Properties", "Build"]}
                icons={["tune", "view_headline"]}
                onChange={onSelectSubview.bind(this)}
              />
            </div>

            {
              {
                0: (
                  <React.Fragment>
                    <div className="environment-properties">
                      <MDCTextFieldReact
                        classNames={["fullwidth", "push-down-7"]}
                        label="Environment name"
                        onChange={onChangeName.bind(this)}
                        value={state.environment.name}
                      />

                      <div className="select-button-columns">
                        <MDCSelectReact
                          ref={refManager.nrefs.environmentName}
                          classNames={["fullwidth"]}
                          label="Base image"
                          onChange={onChangeBaseImage.bind(this)}
                          value={state.environment.base_image}
                          options={state.baseImages.map((el) => [el])}
                        />
                        <MDCButtonReact
                          icon="add"
                          label="Custom image"
                          onClick={onAddCustomBaseImage.bind(this)}
                        />
                        <div className="clear"></div>
                      </div>
                      <div className="form-helper-text push-down-7">
                        The base image will be the starting point from which the
                        environment will be built.
                      </div>

                      <MDCSelectReact
                        label="Language"
                        classNames={["fullwidth"]}
                        ref={refManager.nrefs.environmentLanguage}
                        onChange={onChangeLanguage.bind(this)}
                        options={[
                          ["python", LANGUAGE_MAP["python"]],
                          ["r", LANGUAGE_MAP["r"]],
                          ["julia", LANGUAGE_MAP["julia"]],
                        ]}
                        value={state.environment.language}
                      />
                      <div className="form-helper-text push-down-7">
                        The language determines for which kernel language this
                        environment can be used. This only affects pipeline
                        steps that point to a Notebook.
                      </div>

                      {(() => {
                        if (state.languageDocsNotice === true) {
                          return (
                            <div className="docs-notice push-down-7">
                              Language explanation
                            </div>
                          );
                        }
                      })()}

                      <MDCCheckboxReact
                        onChange={onGPUChange.bind(this)}
                        label="GPU support"
                        classNames={["push-down-7"]}
                        value={state.environment.gpu_support}
                        ref={refManager.nrefs.environmentGPUSupport}
                      />

                      {(() => {
                        if (state.environment.gpu_support === true) {
                          let enabledBlock = (
                            <p className="push-down-7">
                              If enabled, the environment will request GPU
                              capabilities when in use.
                            </p>
                          );
                          if (
                            context.state?.config["GPU_ENABLED_INSTANCE"] !==
                            true
                          ) {
                            if (context.state?.config["CLOUD"] === true) {
                              return (
                                <div className="docs-notice push-down-7">
                                  <p>
                                    This instance is not configured with a GPU.
                                    To request a GPU instance please fill out
                                    this{" "}
                                    <a
                                      target="_blank"
                                      href={
                                        context.state?.config["GPU_REQUEST_URL"]
                                      }
                                    >
                                      form
                                    </a>
                                    .
                                  </p>
                                </div>
                              );
                            } else {
                              return (
                                <div className="docs-notice push-down-7">
                                  {enabledBlock}
                                  <p>
                                    Check out{" "}
                                    <a
                                      target="_blank"
                                      href={
                                        context.state?.config.ORCHEST_WEB_URLS
                                          .readthedocs +
                                        "/getting_started/installation.html#gpu-support"
                                      }
                                    >
                                      the documentation
                                    </a>{" "}
                                    to make sure Orchest is properly configured
                                    for environments with GPU support. In
                                    particular, make sure the selected base
                                    image supports GPU pass through.
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
                      })()}
                    </div>
                  </React.Fragment>
                ),
                1: (
                  <>
                    <h3>Environment set-up script</h3>
                    <div className="form-helper-text push-down-7">
                      This will execute when you build the environment. Use it
                      to include your dependencies.
                    </div>
                    <div className="push-down-7">
                      <CodeMirror
                        value={state.environment.setup_script}
                        options={{
                          mode: "application/x-sh",
                          theme: "jupyter",
                          lineNumbers: true,
                          viewportMargin: Infinity,
                        }}
                        onBeforeChange={(editor, data, value) => {
                          state.environment.setup_script = value;

                          setState((prevState) => ({
                            ...prevState,
                            environment: state.environment,
                            unsavedChanges: true,
                          }));
                        }}
                      />
                    </div>
                    {state.environment && state.environment.uuid !== "new" && (
                      <ImageBuildLog
                        buildFetchHash={state.buildFetchHash}
                        buildRequestEndpoint={`/catch/api-proxy/api/environment-builds/most-recent/${props.queryArgs.project_uuid}/${state.environment.uuid}`}
                        buildsKey="environment_builds"
                        socketIONamespace={
                          context.state?.config[
                            "ORCHEST_SOCKETIO_ENV_BUILDING_NAMESPACE"
                          ]
                        }
                        streamIdentity={
                          state.environment.project_uuid +
                          "-" +
                          state.environment.uuid
                        }
                        onUpdateBuild={onUpdateBuild.bind(this)}
                        onBuildStart={onBuildStart.bind(this)}
                        ignoreIncomingLogs={state.ignoreIncomingLogs}
                        build={state.environmentBuild}
                        building={state.building}
                      />
                    )}
                  </>
                ),
              }[state.subviewIndex]
            }

            <div className="multi-button">
              <MDCButtonReact
                classNames={["mdc-button--raised", "themed-secondary"]}
                onClick={onSave.bind(this)}
                label={state.unsavedChanges ? "Save*" : "Save"}
                icon="save"
              />

              {state.subviewIndex == 1 &&
                state.environment.uuid != "new" &&
                (!state.building ? (
                  <MDCButtonReact
                    disabled={state.buildRequestInProgress}
                    classNames={["mdc-button--raised"]}
                    onClick={build.bind(this)}
                    label="Build"
                    icon="memory"
                  />
                ) : (
                  <MDCButtonReact
                    disabled={state.cancelBuildRequestInProgress}
                    classNames={["mdc-button--raised"]}
                    onClick={cancelBuild.bind(this)}
                    label="Cancel build"
                    icon="close"
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default EnvironmentEditView;
