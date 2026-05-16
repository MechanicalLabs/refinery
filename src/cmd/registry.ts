import { Registry } from "../core/strategy/registry-class";
import { buildCmd } from "./build";
import { initCmd } from "./init";
import { migrateCmd } from "./migrate";
import type { Cmd } from "./types";

export const CommandRegistry = new Registry<Cmd>([buildCmd, initCmd, migrateCmd]);
