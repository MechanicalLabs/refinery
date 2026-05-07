export class RefineryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProjectNameRequiredError extends RefineryError {
  constructor() {
    super("Name is required");
  }
}

export class ProjectNameInvalidError extends RefineryError {
  constructor() {
    super("Name can only contain letters, numbers, dashes, and underscores");
  }
}
