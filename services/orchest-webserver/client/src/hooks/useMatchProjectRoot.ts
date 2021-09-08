import { siteMap } from "@/routingConfig";
import { useRouteMatch } from "react-router-dom";

const useMatchProjectRoot = () => {
  const jobs = useRouteMatch({ path: siteMap.jobs.path, exact: true });
  const environments = useRouteMatch({
    path: siteMap.environments.path,
    exact: true,
  });
  const pipelines = useRouteMatch({
    path: siteMap.pipelines.path,
    exact: true,
  });

  return jobs || environments || pipelines;
};

export { useMatchProjectRoot };
