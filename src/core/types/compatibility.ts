import { Abi } from "./abi";
import { Os } from "./os";

/**
 * Defines which ABIs are compatible with a specific Operating System.
 */
export function getCompatibleAbis(os: string): (typeof Abi)[keyof typeof Abi][] {
  if (os === Os.linux) {
    return [Abi.gnu, Abi.musl];
  }

  if (os === Os.windows) {
    return [Abi.gnu, Abi.msvc];
  }

  // macOS and others don't have multiple ABI options in this context
  return [];
}

/**
 * Determines if an OS requires an ABI definition.
 */
export function isAbiRequired(os: string): boolean {
  return os !== Os.macos;
}
