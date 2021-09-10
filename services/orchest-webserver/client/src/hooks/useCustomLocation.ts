import { useLocation } from "react-router-dom";

// const [email, mobile, isActive] = useLocationState<[string, number]>(['email', 'mobile', 'isActive'])
// console.log(email); // 'john@email.com'
// console.log(mobile); // 0612345678
// console.log(isActive); // true
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
const useLocationQuery = (queryStrings: string[]) => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  return queryStrings.map((str) => query.get(str));
};

export { useLocationState, useLocationQuery };
