import { Request, Response, NextFunction } from 'express';
import { NODE_ENV } from '../config/env';

const errorHandler = (
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    // Show stack trace only in development
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export { errorHandler };