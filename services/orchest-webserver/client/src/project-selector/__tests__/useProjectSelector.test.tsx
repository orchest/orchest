import { ProjectsContextProvider } from "@/contexts/ProjectsContext";
import { Project } from "@/types";
import { chance, mockProjects } from "@/__mocks__/mockProjects.mock";
import { renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { SWRConfig } from "swr";
import { useProjectSelector } from "../useProjectSelector";

const wrapper = ({ children }) => {
  return (
    <SWRConfig value={{ revalidateOnMount: true, provider: () => new Map() }}>
      <ProjectsContextProvider>{children}</ProjectsContextProvider>;
    </SWRConfig>
  );
};

const useTestHook = (
  projectUuidFromRoute: string | undefined,
  targetRoutePath: string | undefined
) => {
  const values = useProjectSelector(
    projectUuidFromRoute,
    targetRoutePath,
    navigateToMock
  );

  return values;
};

const navigateToMock = jest.fn(
  (projectUuid: string, path: string | undefined) => undefined
);

const generateMockProjects = (totalProjectCount = 7) => {
  mockProjects.reset();
  let projects: Project[] = [];
  for (let i = 0; i < totalProjectCount; i++) {
    const uuid = chance.guid();
    projects.push(mockProjects.get(uuid).project);
  }

  return projects;
};

describe("useProjectSelector", () => {
  beforeEach(async () => {
    mockProjects.reset();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should do nothing if params are undefined", async () => {
    const { result } = renderHook(() => useTestHook(undefined, undefined), {
      wrapper,
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.validProjectUuid).toEqual(undefined);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toBe(0);
  });

  it("should redirect to the first project without showing the alert if path is given but project UUID is undefined.", async () => {
    const projects = generateMockProjects();
    const mockProjectUuid = projects[0].uuid;

    const { result, waitForNextUpdate } = renderHook(
      () => useTestHook(undefined, "/mock-path"),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.validProjectUuid).toEqual(mockProjectUuid);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      mockProjectUuid,
      "/mock-path",
    ]);
  });

  it("should redirect to the first project with an alert if project UUID is invalid.", async () => {
    const projects = generateMockProjects();
    const mockProjectUuid = projects[0].uuid;

    const { result, waitForNextUpdate } = renderHook(
      () => useTestHook("invalid-project-uuid", "/mock-path"),
      { wrapper }
    );

    await waitForNextUpdate();

    expect(result.current.validProjectUuid).toEqual(mockProjectUuid);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(true);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      mockProjectUuid,
      "/mock-path",
    ]);
  });

  it("should not redirect or show alerts if project UUID is valid", async () => {
    const projects = generateMockProjects();
    // Pick any project except the first one, because the first one is the default if projectUuid is not given.
    const mockProjectUuid = projects[3].uuid;

    const { result, waitForNextUpdate } = renderHook(
      () => useTestHook(mockProjectUuid, "/mock-path"),
      { wrapper }
    );

    await waitForNextUpdate();

    // hook is loaded for the first time
    expect(result.current.validProjectUuid).toEqual(mockProjectUuid);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toBe(0);
  });
});
