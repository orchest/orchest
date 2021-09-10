import { useLocation, useParams, useHistory } from "react-router-dom";
import { useSendAnalyticEvent } from "./useSendAnalyticEvent";

// NOTE: if the parameter is safe to expose to user (i.e. component can read it from the URL), use useLocationQuery
// For the data that we want to persist and we don't want to expose, use useLocationState

// const [email, mobile, isReadOnly] = useLocationState<[string, number, boolean]>(['email', 'mobile', 'isActive'])
// console.log(email); // 'john@email.com'
// console.log(mobile); // 0612345678
// console.log(isReadOnly); // true
const useLocationState = <T>(stateNames: string[]) => {
  const location = useLocation();
  return (stateNames.map((stateName) =>
    location.state ? location.state[stateName] : null
  ) as unknown) as T;
};

// see https://reactrouter.com/web/example/query-parameters
// e.g. https://example.com/user?foo=123&bar=abc
// const [foo, bar] = useLocationQuery(['foo', 'bar']);
// console.log(foo); // '123'
// console.log(bar); // 'abc'
// NOTE: the returned value is ALWAYS a string
const useLocationQuery = (queryStrings: string[]): (string | null)[] => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  return queryStrings.map((str) => query.get(str));
};

// these are common use cases that are all over the place
// if there are specific cases that you need to pass some querystrings or states
// better make use of useLocationQuery and useLocationState
const useCustomRoute = () => {
  const history = useHistory();
  const location = useLocation();
  useSendAnalyticEvent("view load", { name: location.pathname });

  const [isReadOnly] = useLocationState<[boolean]>(["isReadOnly"]);
  const [jobUuidFromQueryString, runUuid, initialTab] = useLocationQuery([
    "job_uuid",
    "run_uuid",
    "initial_tab",
  ]);
  const {
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    jobUuid,
  } = useParams<{
    projectUuid: string;
    pipelineUuid: string;
    jobUuid: string;
    environmentUuid: string;
    stepUuid: string;
  }>();

  return {
    history,
    isReadOnly,
    projectUuid,
    pipelineUuid,
    environmentUuid,
    stepUuid,
    jobUuid: jobUuid || jobUuidFromQueryString, // we prioritize jobUuid from route parameters
    runUuid,
    initialTab,
  };
};

export { useLocationState, useLocationQuery, useCustomRoute };
