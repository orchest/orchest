import * as React from "react";
import { useHistory } from "react-router-dom";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
  LANGUAGE_MAP,
} from "@orchest/lib-utils";
import {
  MDCButtonReact,
  MDCDataTableReact,
  MDCIconButtonToggleReact,
  MDCLinearProgressReact,
} from "@orchest/lib-mdc";
import { useInterval } from "@/hooks/use-interval";
import { generatePathFromRoute, siteMap } from "@/Routes";

export interface IEnvironmentListProps {
  projectId: string;
}

const EnvironmentList: React.FC<IEnvironmentListProps> = (props) => {
  const history = useHistory();
  const [
    environmentBuildsInterval,
    setEnvironmentBuildsInterval,
  ] = React.useState(null);
  const [state, setState] = React.useState({
    isDeleting: false,
    environments: undefined,
    environmentBuilds: {},
    listData: undefined,
  });

  const BUILD_POLL_FREQUENCY = 3000;

  const orchest = window.orchest;
  const [promiseManager] = React.useState(new PromiseManager());
  const [refManager] = React.useState(new RefManager());

  const environmentBuildsRequest = () => {
    let environmentBuildsRequestPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/environment-builds/most-recent/${props.projectId}`
      ),
      promiseManager
    );

    environmentBuildsRequestPromise.promise
      .then((response) => {
        try {
          let environmentBuilds = JSON.parse(response).environment_builds;
          updateStateForEnvironmentBuilds(environmentBuilds);
        } catch (error) {
          console.error(error);
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const updateStateForEnvironmentBuilds = (updatedEnvironmentBuilds) => {
    let environmentBuilds = {};
    for (let environmentBuild of updatedEnvironmentBuilds) {
      environmentBuilds[
        environmentBuild.project_uuid + "-" + environmentBuild.environment_uuid
      ] = environmentBuild;
    }

    setState((prevState) => ({
      ...prevState,
      environmentBuilds,
      listData: processListData(prevState.environments, environmentBuilds),
    }));
  };

  const fetchEnvironments = () => {
    // fetch data sources
    let environmentsPromise = makeCancelable(
      makeRequest("GET", `/store/environments/` + props.projectId),
      promiseManager
    );

    environmentsPromise.promise
      .then((result) => {
        try {
          let environments = JSON.parse(result);

          setState((prevState) => ({
            ...prevState,
            environments: environments,
            listData: processListData(
              environments,
              prevState.environmentBuilds
            ),
          }));

          // in case environmentListView exists, clear checks
          if (refManager.refs.environmentListView) {
            refManager.refs.environmentListView.setSelectedRowIds([]);
          }
        } catch (error) {
          console.log(error);
          console.log("Error parsing JSON response: ", result);
        }
      })
      .catch((err) => {
        if (err && err.status == 404) {
          history.push(siteMap.projects.path);
        }

        console.log("Error fetching Environments", err);
      });
  };

  const onClickListItem = (row, idx, e) => {
    let environment = state.environments[idx];
    history.push(
      generatePathFromRoute(siteMap.environment.path, {
        projectId: props.projectId,
        environmentId: environment.uuid,
      })
    );
  };

  const onCreateClick = () => {
    history.push(
      generatePathFromRoute(siteMap.environment.path, {
        projectId: props.projectId,
        // environmentId: environment.uuid, // TODO: handle new environment case
      })
    );
  };

  const _removeEnvironment = (
    project_uuid,
    environment_uuid,
    environmentName
  ) => {
    // ultimately remove Image
    makeRequest(
      "DELETE",
      `/store/environments/${project_uuid}/${environment_uuid}`
    )
      .then((_) => {
        // reload list once removal succeeds
        fetchEnvironments();
      })
      .catch((e) => {
        let errorMessage = "unknown";
        try {
          errorMessage = JSON.parse(e.body).message;
        } catch (e) {
          console.error(e);
        }
        orchest.alert(
          "Error",
          "Deleting environment '" +
            environmentName +
            "' failed. " +
            errorMessage
        );
      });
  };

  const removeEnvironment = (
    project_uuid,
    environment_uuid,
    environmentName
  ) => {
    // Do not allow environment deletions if a session is ongoing.
    makeRequest(
      "GET",
      `/catch/api-proxy/api/sessions/?project_uuid=${project_uuid}`
    ).then((response: string) => {
      let data = JSON.parse(response);
      if (data.sessions.length > 0) {
        makeRequest(
          "GET",
          `/catch/api-proxy/api/environment-builds/most-recent/${project_uuid}/${environment_uuid}`
        ).then((response: string) => {
          let data = JSON.parse(response);
          if (data.environment_builds.some((x) => x.status == "SUCCESS"))
            orchest.alert(
              "Error",
              "Environments cannot be deleted with a running interactive session."
            );
          else {
            _removeEnvironment(project_uuid, environment_uuid, environmentName);
          }
        });
      } else {
        // validate if environment is in use, if it is, prompt user
        // specifically on remove.
        makeRequest(
          "GET",
          `/catch/api-proxy/api/environment-images/in-use/${project_uuid}/${environment_uuid}`
        ).then((response: string) => {
          let data = JSON.parse(response);
          if (data.in_use) {
            orchest.confirm(
              "Warning",
              "The environment you're trying to delete (" +
                environmentName +
                ") is in use. " +
                "Are you sure you want to delete it? This will abort all jobs that are using it.",
              () => {
                _removeEnvironment(
                  project_uuid,
                  environment_uuid,
                  environmentName
                );
              }
            );
          } else {
            _removeEnvironment(project_uuid, environment_uuid, environmentName);
          }
        });
      }
    });
  };

  const onDeleteClick = () => {
    if (!state.isDeleting) {
      setState((prevState) => ({
        ...prevState,
        isDeleting: true,
      }));

      let selectedIndices = refManager.refs.environmentListView.getSelectedRowIndices();

      if (selectedIndices.length === 0) {
        orchest.alert("Error", "You haven't selected any environments.");

        setState((prevState) => ({
          ...prevState,
          isDeleting: false,
        }));

        return;
      }

      orchest.confirm(
        "Warning",
        "Are you certain that you want to delete the selected environments?",
        () => {
          selectedIndices.forEach((idx) => {
            let environment_uuid = state.environments[idx].uuid;
            let project_uuid = state.environments[idx].project_uuid;
            removeEnvironment(
              project_uuid,
              environment_uuid,
              state.environments[idx].name
            );
          });

          setState((prevState) => ({
            ...prevState,
            isDeleting: false,
          }));
        },
        () => {
          setState((prevState) => ({
            ...prevState,
            isDeleting: false,
          }));
        }
      );
    } else {
      console.error("Delete UI in progress.");
    }
  };

  const processListData = (environments, environmentBuilds) => {
    let listData = [];

    // check for undefined environments
    if (!environments) {
      return listData;
    }

    for (let environment of environments) {
      let environmentBuild =
        environmentBuilds[props.projectId + "-" + environment.uuid];

      listData.push([
        <span>{environment.name}</span>,
        <span>{LANGUAGE_MAP[environment.language]}</span>,
        <span>
          {environment.gpu_support ? (
            <>
              <span>Enabled </span>
              <i className="material-icons lens-button">lens</i>
            </>
          ) : (
            <>
              <span>Disabled </span>
              <i className="material-icons disabled lens-button">lens</i>
            </>
          )}
        </span>,
        <span>{environmentBuild ? environmentBuild.status : "NOT BUILT"}</span>,
      ]);
    }
    return listData;
  };

  useInterval(() => {
    environmentBuildsRequest();
  }, environmentBuildsInterval);

  React.useEffect(() => {
    fetchEnvironments();
    environmentBuildsRequest();
    setEnvironmentBuildsInterval(BUILD_POLL_FREQUENCY);

    return () => {
      promiseManager.cancelCancelablePromises();
      setEnvironmentBuildsInterval(null);
    };
  }, []);

  return (
    <div className={"environments-page"}>
      <h2>Environments</h2>

      {(() => {
        if (state.environments) {
          return (
            <React.Fragment>
              <div className="push-down">
                <MDCButtonReact
                  classNames={["mdc-button--raised", "themed-secondary"]}
                  icon="add"
                  label="Create environment"
                  onClick={onCreateClick}
                  data-test-id="environments-create"
                />
              </div>
              <div className={"environment-actions push-down"}>
                <MDCIconButtonToggleReact
                  icon="delete"
                  tooltipText="Delete environment"
                  disabled={state.isDeleting}
                  onClick={onDeleteClick}
                  data-test-id="environments-delete"
                />
              </div>

              <MDCDataTableReact
                ref={refManager.nrefs.environmentListView}
                selectable
                onRowClick={onClickListItem}
                classNames={["fullwidth"]}
                headers={[
                  "Environment",
                  "Language",
                  "GPU Support",
                  "Build status",
                ]}
                rows={state.listData}
                data-test-id="environments"
              />
            </React.Fragment>
          );
        } else {
          return <MDCLinearProgressReact />;
        }
      })()}
    </div>
  );
};

export default EnvironmentList;
