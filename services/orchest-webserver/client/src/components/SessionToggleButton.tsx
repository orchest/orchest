import * as React from "react";
import { MDCButtonReact, MDCSwitchReact } from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";
import type { IOrchestSession } from "@/types";

export type TSessionToggleButtonRef = HTMLButtonElement;
export interface ISessionToggleButtonProps
  extends React.HTMLAttributes<TSessionToggleButtonRef> {
  pipelineUuid: IOrchestSession["pipelineUuid"];
  projectUuid: IOrchestSession["projectUuid"];
  switch?: boolean;
}

const SessionToggleButton = React.forwardRef<
  TSessionToggleButtonRef,
  ISessionToggleButtonProps
>((props, ref) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const { state, dispatch, get } = useOrchest();

  const { pipelineUuid, projectUuid } = props;
  const session = get.session({
    pipelineUuid,
    projectUuid,
  });

  const sharedProps = {
    disabled: isLoading || ["STOPPING", "LAUNCHING"].includes(session?.status),
    label:
      {
        STOPPING: "Session stopping…",
        LAUNCHING: "Session starting…",
        RUNNING: "Stop session",
      }[session?.status] || "Start session",
  };

  const handleEvent = (e) => {
    e.preventDefault();
    dispatch({
      type: "sessionToggle",
      payload: { pipelineUuid, projectUuid },
    });
  };

  React.useEffect(() => setIsLoading(state.sessionsIsLoading), [
    state.sessionsIsLoading,
  ]);

  return (
    <>
      {props.switch ? (
        <MDCSwitchReact
          ref={ref as any}
          {...sharedProps}
          onChange={handleEvent}
          classNames={props.className}
          on={session?.status === "RUNNING"}
        />
      ) : (
        <MDCButtonReact
          ref={ref as any}
          {...sharedProps}
          onClick={handleEvent}
          classNames={[
            props.className,
            "mdc-button--outlined",
            "session-state-button",
            // @rick do we need these?
            {
              LAUNCHING: "working",
              STOPPING: "working",
            }[session?.status] || "active",
          ]}
          icon={session?.status === "RUNNING" ? "stop" : "play_arrow"}
          data-test-id="session-toggle-button"
        />
      )}
    </>
  );
});

export default SessionToggleButton;
