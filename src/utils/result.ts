/**
 * i miss rust's Result type haha
 * i really hope that the `?=` operator will come to js/ts one day...
 */

/**
 * A Result type representing either a success (Ok) or an error (Err).
 * @template T The type of the success value.
 * @template E The type of the error value.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Constructs a successful Result containing the given value.
 * @param value The value to wrap in an Ok result.
 * @returns A Result object representing success.
 */
export function Ok<T, E>(value: T): Result<T, E> {
  return { ok: true, value };
}

/**
 * Constructs an error Result containing the given error.
 * @param error The error to wrap in an Err result.
 * @returns A Result object representing an error.
 */
export function Err<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

/**
 * Unwraps a Result, returning the contained value if it's Ok, or a default value if it's Err.
 * @param result The Result to unwrap.
 * @param defaultValue The value to return if the Result is an Err.
 * @returns The contained value if Ok, otherwise the default value.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }

  return defaultValue;
}

/**
 * Matches a Result against different handlers for Ok and Err cases.
 * @param result The Result to match.
 * @param handlers The handlers for Ok and Err cases.
 * @returns The result of the appropriate handler.
 */
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => R;
    err: (error: E) => R;
  },
): R {
  if (result.ok) {
    return handlers.ok(result.value);
  }

  return handlers.err(result.error);
}

/**
 * Maps a Result's success value using the provided function, leaving errors unchanged.
 * @param result The Result to map.
 * @param fn The function to apply to the success value if it's Ok.
 * @returns A new Result with the mapped success value or the original error.
 */
export function map<T, E, R>(result: Result<T, E>, fn: (value: T) => R): Result<R, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }

  return result;
}

/**
 * Maps a Result's error value using the provided function, leaving successes unchanged.
 * @param result The Result to map.
 * @param fn The function to apply to the error value if it's Err.
 * @returns A new Result with the mapped error value or the original success.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return Err(fn(result.error));
  }

  return result;
}

/**
 * Chains a sequence of operations that may fail, short-circuiting on the first error.
 * @param result The initial Result.
 * @param fn The function to apply to the success value if it's Ok.
 * @returns A new Result representing the chained operation.
 */
export function andThen<T, E, R>(
  result: Result<T, E>,
  fn: (value: T) => Result<R, E>,
): Result<R, E> {
  if (result.ok) {
    return fn(result.value);
  }

  return result;
}

/**
 * Chains a sequence of operations that may fail, short-circuiting on the first error, and allowing error transformation.
 * @param result The initial Result.
 * @param fn The function to apply to the error value if it's Err.
 * @returns A new Result representing the chained operation with potential error transformation.
 */
export function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>,
): Result<T, F> {
  if (!result.ok) {
    return fn(result.error);
  }

  return result;
}

/**
 * Converts a Promise into a Result.
 * @param promise The Promise to convert.
 * @returns A Promise resolving to a Result.
 */
export async function fromPromise<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return Ok(data);
  } catch (e) {
    return Err(e as E);
  }
}

/**
 * Represents a Result that is asynchronously resolved.
 * @param T The type of the success value.
 * @param E The type of the error value.
 */
export type AsyncResult<T, E> = Promise<Result<T, E>>;
