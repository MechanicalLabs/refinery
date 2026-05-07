import { RefineryError } from "..";

export class IoFileNotFound extends RefineryError {
  constructor() {
    super("File not found");
  }
}
