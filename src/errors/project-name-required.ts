import { RefineryError } from ".";

export class ProjectNameRequiredError extends RefineryError {
  constructor() {
    super("Name is required");
  }
}
