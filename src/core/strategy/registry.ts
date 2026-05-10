import { Err, Ok, type Result } from "ripthrow";
import { Errors } from "../../errors";
import { rustStrategy } from "../lang/rust/strategy";
import { githubStrategy } from "../platforms/github/strategy";
import type { LanguageStrategy, PlatformStrategy } from "./types";

export const LanguageRegistry: LanguageStrategy[] = [rustStrategy];

export const PlatformRegistry: PlatformStrategy[] = [githubStrategy];

export function getLanguageStrategy(id: string): Result<LanguageStrategy, Error> {
  const strategy = LanguageRegistry.find((s) => s.id === id);

  if (strategy) {
    return Ok(strategy);
  }
  return Err(Errors.invalidStrategy({ strategy: id }));
}

export function getPlatformStrategy(id: string): Result<PlatformStrategy, Error> {
  const strategy = PlatformRegistry.find((s) => s.id === id);

  if (strategy) {
    return Ok(strategy);
  }

  return Err(Errors.invalidStrategy({ strategy: id }));
}
