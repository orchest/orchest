import { OrchestConfig } from "@/types";
import { mockConfig } from "@/__mocks__/mockConfig.mock";
import { act, renderHook } from "@testing-library/react-hooks";
import * as React from "react";
import { SWRConfig } from "swr";
import { useOrchestUserConfig } from "../useOrchestUserConfig";

const wrapper = ({ children = null }) => {
  return (
    <SWRConfig value={{ revalidateOnMount: true, provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
};

const setAsSaved = jest.fn((value?: boolean | undefined) => undefined);

const useTestHook = (config: OrchestConfig | undefined) => {
  const values = useOrchestUserConfig(setAsSaved, config);
  return values;
};

const parseJson = (str: string | undefined) => JSON.parse(str || "{}");

describe("useOrchestUserConfig", () => {
  const { result, waitForNextUpdate, unmount, rerender } = renderHook<
    { config: OrchestConfig | undefined; children?: null },
    ReturnType<typeof useOrchestUserConfig>
  >(({ config }) => useTestHook(config), {
    wrapper,
    initialProps: {
      config: undefined,
    },
  });

  const runStartCase = async () => {
    // Load user_config as a starting test case.
    const userConfig = mockConfig.get().user_config;

    rerender({ config: mockConfig.get().config });

    await waitForNextUpdate();

    expect(parseJson(result.current.userConfig)).toEqual(userConfig);
    expect(result.current.requiresRestart).toEqual([]);
    expect(setAsSaved.mock.calls.length).toEqual(0);
  };

  beforeEach(async () => {
    mockConfig.reset();
    jest.clearAllMocks();
    unmount();
  });

  it("should load user config", async () => {
    await runStartCase();
  });

  it("should save user config and get corresponding requires_restart", async () => {
    await runStartCase();
    const userConfigJson = mockConfig.get().user_config;
    const updatedConfigJson = {
      ...userConfigJson,
      AUTH_ENABLED: !userConfigJson.AUTH_ENABLED,
      TELEMETRY_DISABLED: !userConfigJson.TELEMETRY_DISABLED,
    };

    act(() => {
      result.current.setUserConfig(JSON.stringify(updatedConfigJson));
    });

    expect(parseJson(result.current.userConfig)).toEqual(updatedConfigJson);
    expect(result.current.requiresRestart).toEqual([]);
    expect(setAsSaved.mock.calls.length).toEqual(1);
    expect(setAsSaved.mock.calls.slice(-1)[0]).toEqual([false]);
    expect(result.current.saveUserConfigError).toEqual(undefined);

    act(() => {
      result.current.saveUserConfig();
    });

    await waitForNextUpdate();

    expect(parseJson(result.current.userConfig)).toEqual(updatedConfigJson);
    expect(result.current.requiresRestart.sort()).toEqual(
      ["AUTH_ENABLED", "TELEMETRY_DISABLED"].sort()
    );

    expect(setAsSaved.mock.calls.length).toEqual(2);
    expect(setAsSaved.mock.calls.slice(-1)[0]).toEqual([true]);
    expect(result.current.saveUserConfigError).toEqual(undefined);
  });

  it("should throw an error if userConfig is an invalid JSON string", async () => {
    await runStartCase();
    const userConfigJson = mockConfig.get().user_config;
    const updatedConfigJson = {
      ...userConfigJson,
      AUTH_ENABLED: !userConfigJson.AUTH_ENABLED,
      TELEMETRY_DISABLED: !userConfigJson.TELEMETRY_DISABLED,
    };

    const invalidJsonString = JSON.stringify(updatedConfigJson).slice(1);

    act(() => {
      result.current.setUserConfig(invalidJsonString);
    });

    expect(result.current.userConfig).toEqual(invalidJsonString);
    expect(result.current.requiresRestart).toEqual([]);
    expect(setAsSaved.mock.calls.length).toEqual(1);
    expect(setAsSaved.mock.calls.slice(-1)[0]).toEqual([false]);
    expect(result.current.saveUserConfigError).toEqual(undefined);

    act(() => {
      result.current.saveUserConfig();
    });

    // The JSON string parsing validation takes place on the client side,
    // therefore no actual async operation was fired.

    expect(result.current.userConfig).toEqual(invalidJsonString);
    expect(result.current.requiresRestart).toEqual([]);

    expect(setAsSaved.mock.calls.length).toEqual(1);
    expect(setAsSaved.mock.calls.slice(-1)[0]).toEqual([false]);
    expect(result.current.saveUserConfigError).toBeDefined();
  });
});
