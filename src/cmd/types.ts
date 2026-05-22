import type { AsyncResult } from "ripthrow";
import type { Registrable } from "../core/strategy/registry-class";

interface CmdOption {
  flags: string;
  description: string;
}

export interface Cmd extends Registrable {
  description: string;
  options?: CmdOption[];
  action: (options: Record<string, unknown>) => AsyncResult<void, Error> | void | Promise<void>;
}
