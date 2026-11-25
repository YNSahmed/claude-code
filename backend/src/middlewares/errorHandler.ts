import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface PgError {
  code: string;
  constraint?: string;
}

function isPgError(error: unknown): error is PgError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    /^[0-9A-Z]{5}$/.test((error as { code: string }).code)
  );
}

/** Friendly responses for constraint names defined in the migrations. */
const CONSTRAINT_ERRORS: Record<string, [number, string, string]> = {
  wallets_deposit_balance_non_negative: [409, 'INSUFFICIENT_BALANCE', 'Not enough balance.'],
  wallets_winning_balance_non_negative: [409, 'INSUFFICIENT_BALANCE', 'Not enough winnings.'],
  wallets_bonus_balance_non_negative: [409, 'INSUFFICIENT_BALANCE', 'Not enough bonus balance.'],
  wallets_locked_balance_non_negative: [409, 'INSUFFICIENT_BALANCE', 'Not enough locked balance.'],
  ledger_balance_after_non_negative: [409, 'INSUFFICIENT_BALANCE', 'Not enough balance.'],
  tournaments_slots_within_capacity: [409, 'TOURNAMENT_FULL', 'All slots are taken.'],
  tournament_participants_one_entry_per_user: [409, 'ALREADY_JOINED', 'You have already joined this tournament.'],
  tournament_participants_one_entry_per_uid: [409, 'UID_ALREADY_REGISTERED', 'This Free Fire UID is already registered.'],
  tournament_participants_one_player_per_slot: [409, 'SLOT_TAKEN', 'That slot was just taken. Try again.'],
  users_phone_key: [409, 'PHONE_TAKEN', 'An account with this phone number already exists.'],
  users_free_fire_uid_key: [409, 'UID_TAKEN', 'This Free Fire UID is linked to another account.'],
};

function fromPostgres(error: PgError): AppError {
  const known = error.constraint ? CONSTRAINT_ERRORS[error.constraint] : undefined;
  if (known) return new AppError(...known);

  switch (error.code) {
    case '23505': // unique_violation
      return new AppError(409, 'DUPLICATE', 'This already exists.');
    case '23503': // foreign_key_violation
      return new AppError(400, 'INVALID_REFERENCE', 'A referenced record does not exist.');
    case '23514': // check_violation
    case '23502': // not_null_violation
    case '22P02': // invalid_text_representation (e.g. bad uuid)
      return new AppError(400, 'INVALID_DATA', 'The request contains invalid data.');
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
    case '55P03': // lock_not_available (lock_timeout)
    case '57014': // query_canceled (statement_timeout)
      return new AppError(503, 'BUSY', 'The server is busy. Please retry.');
    default:
      return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong.');
  }
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'The request is invalid.', {
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  // body-parser errors carry a `type`.
  const type = (error as { type?: unknown } | null)?.type;
  if (type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  if (type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  if (isPgError(error)) return fromPostgres(error);
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong.');
}

/** Turns every error into `{ error: { code, message, details?, requestId } }` without leaking internals. */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const appError = toAppError(error);

  if (appError.status >= 500) {
    logger.error('Request failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
      pgCode: isPgError(error) ? error.code : undefined,
      constraint: isPgError(error) ? error.constraint : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  if (res.headersSent) return;
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
      requestId: req.requestId,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: req.requestId } });
}
