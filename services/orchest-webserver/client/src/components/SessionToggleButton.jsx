// @ts-check
import React from "react";
import { MDCButtonReact, MDCSwitchReact } from "@orchest/lib-mdc";
import { useOrchest } from "@/hooks/orchest";

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
  const { dispatch, get } = useOrchest();

  const { pipeline_uuid, project_uuid } = props;
  const session = get.session({ pipeline_uuid, project_uuid });

  const sharedProps = {
    disabled:
      isLoading ||
      !session?.status ||
      ["STOPPING", "LAUNCHING"].includes(session?.status),
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

  React.useEffect(() => setIsLoading(session ? false : true), [session]);

  React.useEffect(() => {
    dispatch({
      type: "sessionFetch",
      payload: { pipeline_uuid, project_uuid },
    });
  }, [pipeline_uuid, project_uuid]);

  return props.switch ? (
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
          RUNNING: "active",
          LAUNCHING: "working",
          STOPPING: "working",
          STOPPED: "active",
        }[session?.status] || "",
      ]}
      icon={session?.status === "RUNNING" ? "stop" : "play_arrow"}
    />
  );
});

export default SessionToggleButton;
