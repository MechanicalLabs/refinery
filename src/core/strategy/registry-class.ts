import { Err, Ok, type Result } from "ripthrow";
import { Errors } from "../../errors";

export interface Registrable {
  id: string;
}

export class Registry<T extends Registrable> {
  private readonly items = new Map<string, T>();

  constructor(initialItems: T[] = []) {
    for (const item of initialItems) {
      this.register(item);
    }
  }

  register(item: T): void {
    this.items.set(item.id, item);
  }

  get(id: string): Result<T, Error> {
    const item = this.items.get(id);
    if (item) {
      return Ok(item);
    }
    return Err(Errors.invalidStrategy({ strategy: id }));
  }

  all(): T[] {
    return Array.from(this.items.values());
  }
}
