import { RefineryError } from ".";

export class ProjectNameInvalidError extends RefineryError {
  constructor() {
    super("Name can only contain letters, numbers, dashes, and underscores");
  }
}
