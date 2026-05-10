import { Registry } from "../core/strategy/registry-class";
import { initCmd } from "./init";
import type { Cmd } from "./types";

export const CommandRegistry = new Registry<Cmd>([initCmd]);
