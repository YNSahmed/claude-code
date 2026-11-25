import type { ZodType, z } from 'zod';

/** An error that is safe to show to the client: status, stable code, message and optional details. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Sign in to continue.') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(403, code, message, details);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(409, code, message, details);

/** Parses untrusted input with a zod schema, turning failures into a 400 with every issue listed. */
export function parseInput<S extends ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest('VALIDATION_ERROR', 'The request is invalid.', {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return result.data;
}
