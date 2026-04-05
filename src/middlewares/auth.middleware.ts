import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { Reader } from '../modules/reader/auth/reader.model';
import { Writer } from '../modules/writer/auth/writer.auth.model';
// Extend Express Request globally — no need for AuthRequest interface anymore
declare global {
  namespace Express {
    interface Request {
      readerId?: string;
      writerId?: string;
    }
  }
}

// ─────────────────────────────────────────
// Verify Reader Token
// Usage: router.get('/profile', verifyReader, getProfile)
// ─────────────────────────────────────────
export const verifyReader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Bearer token exists in header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    // Verify and decode the token
    const decoded = verifyAccessToken(token);

    // Check reader actually exists in DB
    const reader = await Reader.findById(decoded.id);
    if (!reader) {
      return res.status(401).json({
        success: false,
        message: 'Reader not found. Authorization denied.',
      });
    }

    // Check if reader email is verified
    if (!reader.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email first.',
      });
    }

    // Attach reader id to request — available in all next controllers
    req.readerId = decoded.id;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Authorization denied.',
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
    });
  }
};


export const verifyWriter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
    }

    const decoded = verifyAccessToken(token);

    // Check writer actually exists in DB
    const writer = await Writer.findById(decoded.id);
    if (!writer) {
      return res.status(401).json({
        success: false,
        message: 'Writer not found. Authorization denied.',
      });
    }

    // Check if writer email is verified
    if (!writer.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Please verify your email first.',
      });
    }

    // Attach writer id to request
    req.writerId = decoded.id;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Authorization denied.',
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
    });
  }
};