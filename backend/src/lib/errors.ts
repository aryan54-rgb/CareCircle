export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  unauthorized: (msg = 'Unauthorized') => new AppError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Forbidden') => new AppError('FORBIDDEN', msg, 403),
  notFound: (msg = 'Not Found') => new AppError('NOT_FOUND', msg, 404),
  conflict: (msg = 'Conflict') => new AppError('CONFLICT', msg, 409),
  locked: (msg = 'Account temporarily locked. Try again in 15 minutes.') =>
    new AppError('ACCOUNT_LOCKED', msg, 429),
  badRequest: (msg = 'Bad Request') => new AppError('BAD_REQUEST', msg, 400),
  internal: (msg = 'Internal Server Error') => new AppError('INTERNAL_ERROR', msg, 500),
};
