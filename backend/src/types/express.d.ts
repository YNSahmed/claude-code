import type { AuthUser } from '../middlewares/auth.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: AuthUser;
      /** Exact bytes of the request body, captured before JSON parsing (for webhook signatures). */
      rawBody?: Buffer;
      /** Unique id for this request, echoed in the X-Request-Id header and in error responses. */
      requestId: string;
    }
  }
}

export {};
