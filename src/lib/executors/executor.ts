import type { ChildProcess } from "child_process";
import type { SpawnOptions } from "../agents/types";

export interface ExecutorProcess {
  id: string;
  childProcess: ChildProcess;
  agentType: string;
}

export interface Executor {
  spawn(processId: string, options: SpawnOptions): ExecutorProcess;
  kill(processId: string): void;
}
