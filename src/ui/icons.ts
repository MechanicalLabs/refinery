/**
 * Icons used in the logging functions for the CLI UI.
 */

import pc from "picocolors";

/**
 * Class representing an icon for logging purposes. It encapsulates a symbol and provides a method to convert it to a string for display in log messages.
 */
class Icon {
  symbol: string;
  formatter: (text: string) => string;

  constructor(symbol: string, formatter?: (text: string) => string) {
    this.symbol = symbol;
    this.formatter = formatter ?? ((text: string): string => text);
  }

  toString(): string {
    return this.formatter(this.symbol);
  }
}

/*
  ICONS
*/
export const DONE_ICON = new Icon("✓", pc.green);
export const ERROR_ICON = new Icon("✗", pc.red);
export const WARNING_ICON = new Icon("!", pc.yellow);
export const INFO_ICON = new Icon("i", pc.blue);

export function withIcon(icon: Icon, ...message: unknown[]): string {
  return `${icon} ${message.join(" ")}`;
}
