import { ProjectsContextProvider } from "@/contexts/ProjectsContext";
import { chance, mockProjects } from "@/__mocks__/mockProjects.mock";
import { renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { useProjectSelector } from "../useProjectSelector";

describe("useProjectSelector", () => {
  const wrapper = ({ children }) => {
    return <ProjectsContextProvider>{children}</ProjectsContextProvider>;
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

  beforeEach(async () => {
    mockProjects.reset();
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

  it("should not redirect or show alert if project UUID is valid", async () => {
    const mockProjectUuid = chance.guid();

    // Create three projects
    mockProjects.get(mockProjectUuid).project;
    mockProjects.get(chance.guid()).project;
    mockProjects.get(chance.guid()).project;

    const { result, waitForNextUpdate } = renderHook(
      () => useTestHook(mockProjectUuid, "/mock-path"),
      { wrapper }
    );

    await waitForNextUpdate();

    // hook is loaded for the first time
    expect(result.current.projects.length).toBeGreaterThan(0);
    expect(result.current.validProjectUuid).toEqual(mockProjectUuid);
    expect(result.current.shouldShowInvalidProjectUuidAlert).toEqual(false);
    expect(navigateToMock.mock.calls.length).toBe(0);
  });
});
