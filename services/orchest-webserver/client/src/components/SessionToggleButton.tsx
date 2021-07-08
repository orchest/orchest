// @ts-check
import React from "react";
import { MDCButtonReact, MDCSwitchReact } from "@orchest/lib-mdc";
import { useOrchest, OrchestSessionsConsumer } from "@/hooks/orchest";

/**
 * @typedef {import("@/types").IOrchestSession} IOrchestSession
 *
 * @typedef {Object} SessionToggleButtonProps
 * @property {IOrchestSession['pipeline_uuid']} pipeline_uuid
 * @property {IOrchestSession['project_uuid']} project_uuid
 * @property {string} [className]
 * @property {boolean} [switch]
 */

/**
 * @type {React.FC<SessionToggleButtonProps>}
 */
const SessionToggleButton = React.forwardRef((props, ref) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const { state, dispatch, get } = useOrchest();

  const { pipeline_uuid, project_uuid } = props;
  const session = get.session({
    pipeline_uuid,
    project_uuid,
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
      payload: { pipeline_uuid, project_uuid },
    });
  };

  React.useEffect(() => setIsLoading(state.sessionsIsLoading), [
    state.sessionsIsLoading,
  ]);

  return (
    <React.Fragment>
      {props.switch ? (
        <MDCSwitchReact
          ref={ref}
          {...sharedProps}
          onChange={handleEvent}
          classNames={props.className}
          on={session?.status === "RUNNING"}
        />
      ) : (
        <MDCButtonReact
          ref={ref}
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
        />
      )}
    </React.Fragment>
  );
});

export default SessionToggleButton;
