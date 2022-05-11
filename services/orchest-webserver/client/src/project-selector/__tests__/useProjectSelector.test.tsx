import { ProjectsContextProvider } from "@/contexts/ProjectsContext";
import { Project } from "@/types";
import { chance } from "@/__mocks__/common.mock";
import { mockProjects } from "@/__mocks__/mockProjects.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { SWRConfig } from "swr";
import { useProjectSelector } from "../useProjectSelector";

const wrapper = ({ children = null }) => {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <ProjectsContextProvider>{children}</ProjectsContextProvider>;
    </SWRConfig>
  );
};

const navigateToMock = jest.fn(
  (projectUuid: string, path: string | undefined) => undefined
);

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
  const { result, waitForNextUpdate, rerender, unmount } = renderHook<
    {
      children?: null;
      projectUuidFromRoute: string | undefined;
      targetRoutePath: string | undefined;
    },
    {
      validProjectUuid: string | undefined;
      projects: Project[];
      shouldShowInvalidProjectUuidAlert: boolean;
      onChangeProject: (uuid: string) => void;
    }
  >(
    ({ projectUuidFromRoute, targetRoutePath }) =>
      useTestHook(projectUuidFromRoute, targetRoutePath),
    {
      wrapper,
      initialProps: {
        projectUuidFromRoute: undefined,
        targetRoutePath: undefined,
      },
    }
  );
  beforeEach(async () => {
    mockProjects.reset();
    unmount();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should do nothing if params are undefined", async () => {
    rerender({
      projectUuidFromRoute: undefined,
      targetRoutePath: undefined,
    });

    expect(result.current.projects).toEqual([]);
    expect(result.current.validProjectUuid).toEqual(undefined);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toBe(0);
  });

  it("should redirect to the first project without showing the alert if path is given but project UUID is undefined.", async () => {
    const projects = generateMockProjects();
    const mockProjectUuid = projects[0].uuid;

    rerender({
      projectUuidFromRoute: undefined,
      targetRoutePath: "/mock-path",
    });

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

    rerender({
      projectUuidFromRoute: "invalid-project-uuid",
      targetRoutePath: "/mock-path",
    });

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

    rerender({
      projectUuidFromRoute: mockProjectUuid,
      targetRoutePath: "/mock-path",
    });

    await waitForNextUpdate();

    expect(result.current.validProjectUuid).toEqual(mockProjectUuid);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toBe(0);
  });

  it("should be able to change project.", async () => {
    const projects = generateMockProjects();
    const mockProjectUuid = projects[3].uuid;
    const targetProjectUuid = projects[5].uuid;

    rerender({
      projectUuidFromRoute: mockProjectUuid,
      targetRoutePath: "/mock-path",
    });

    await waitForNextUpdate();

    expect(result.current.validProjectUuid).toEqual(mockProjectUuid);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toBe(0);

    act(() => {
      result.current.onChangeProject(targetProjectUuid);
    });

    expect(navigateToMock.mock.calls.length).toBe(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      targetProjectUuid,
      "/mock-path",
    ]);

    rerender({
      projectUuidFromRoute: targetProjectUuid,
      targetRoutePath: "/mock-path",
    });

    expect(result.current.validProjectUuid).toEqual(targetProjectUuid);
    expect(result.current.projects).toEqual(projects);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toEqual(1);
    expect(navigateToMock.mock.calls[0]).toEqual([
      targetProjectUuid,
      "/mock-path",
    ]);
  });
});
