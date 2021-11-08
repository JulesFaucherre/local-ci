interface FullStep {
  checkout?: Record<string, unknown> | string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  attach_workspace?: {
    at?: string;
  };
  // eslint-disable-next-line @typescript-eslint/naming-convention
  persist_to_workspace?: {
    root: string;
    paths: Array<string>;
  };
  run?: string | {
    command?: string;
  };
}

type Step = FullStep | 'checkout' | string;

interface Job {
  docker?: Array<Record<string, string>>;
  steps?: Array<Step>;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  working_directory?: string;
  machine?: { image?: string };
}

type RunningTerminal = number | undefined;
interface RunningTerminals {
  [key: string]: RunningTerminal[]
}