import { useLocation } from "react-router-dom";

// const [email, mobile] = useLocationState<[string, number]>(['email', 'mobile'])
// then you can directly use email and mobile as variables
const useLocationState = <T>(stateNames: string[]) => {
  const location = useLocation();
  return (stateNames.map(
    (stateName) => location.state[stateName]
  ) as unknown) as T;
};

// see https://reactrouter.com/web/example/query-parameters
// e.g. https://example.com/user?custom_variable=foo
// const query = useQuery();
// const value = query.get('custom_variable') // 'foo'
const useLocationQuery = (queryStrings: string[]) => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  return queryStrings.map((str) => query.get(str));
};

export { useLocationState, useLocationQuery };
