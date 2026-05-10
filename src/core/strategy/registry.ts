import { rustStrategy } from "../lang/rust/strategy";
import { githubStrategy } from "../platforms/github/strategy";
import { Registry } from "./registry-class";
import type { LanguageStrategy, PlatformStrategy } from "./types";

export const LanguageRegistry = new Registry<LanguageStrategy>([rustStrategy]);

export const PlatformRegistry = new Registry<PlatformStrategy>([githubStrategy]);
