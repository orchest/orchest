import type { IOrchestSession, IOrchestState } from "@/types";

type Session = {
  project_uuid?: string;
  pipeline_uuid?: string;
  projectUuid?: string;
  pipelineUuid?: string;
};

const getSessionValue = (session: Session | null) => {
  return (
    session && {
      projectUuid: session.projectUuid || session.project_uuid,
      pipelineUuid: session.pipelineUuid || session.pipeline_uuid,
    }
  );
};

// because project_uuid and pipeline_uuid can either be snake_case or camelCase,
// isSession function should be able to compare either case.
export const isSession = (a: Session, b: Session) => {
  if (!a || !b) return false;
  const sessionA = getSessionValue(a);
  const sessionB = getSessionValue(b);

  return !Object.keys(sessionA).some((key) => sessionA[key] !== sessionB[key]);
};

export const isCurrentSession = (
  session: IOrchestSession,
  state: IOrchestState
) => isSession(session, state);
