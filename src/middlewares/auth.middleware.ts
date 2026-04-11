import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { Reader } from '../modules/reader/auth/reader.model';
import { Writer } from '../modules/writer/auth/writer.auth.model';
import { Admin } from '../modules/admin/auth/admin.model';
import { Editor } from '../modules/editor/auth/editor.model';

// All role IDs available on every request
declare global {
  namespace Express {
    interface Request {
      readerId?: string;
      writerId?: string;
      adminId?: string;
      editorId?: string;
    }
  }
}

// ─────────────────────────────────────────
// Reusable token extractor — keeps code DRY
// ─────────────────────────────────────────
const extractToken = (req: Request, res: Response): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'No token provided. Authorization denied.',
    });
    return null;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'No token provided. Authorization denied.',
    });
    return null;
  }

  return token;
};

// ─────────────────────────────────────────
// Verify Reader
// ─────────────────────────────────────────
export const verifyReader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req, res);
    if (!token) return;

    const decoded = verifyAccessToken(token);

    const reader = await Reader.findById(decoded.id);
    if (!reader) {
      return res.status(401).json({ success: false, message: 'Reader not found. Authorization denied.' });
    }

    if (!reader.isVerified) {
      return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });
    }

    req.readerId = decoded.id;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token. Authorization denied.' });
      }
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

// ─────────────────────────────────────────
// Verify Writer
// ─────────────────────────────────────────
export const verifyWriter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req, res);
    if (!token) return;

    const decoded = verifyAccessToken(token);

    const writer = await Writer.findById(decoded.id);
    if (!writer) {
      return res.status(401).json({ success: false, message: 'Writer not found. Authorization denied.' });
    }

    if (!writer.isVerified) {
      return res.status(403).json({ success: false, message: 'Email not verified. Please verify your email first.' });
    }

    req.writerId = decoded.id;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token. Authorization denied.' });
      }
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

// ─────────────────────────────────────────
// Verify Admin
// ─────────────────────────────────────────
export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req, res);
    if (!token) return;

    const decoded = verifyAccessToken(token);

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found. Authorization denied.' });
    }

    req.adminId = decoded.id;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token. Authorization denied.' });
      }
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

// ─────────────────────────────────────────
// Verify Editor
// ─────────────────────────────────────────
export const verifyEditor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req, res);
    if (!token) return;

    const decoded = verifyAccessToken(token);

    const editor = await Editor.findById(decoded.id);
    if (!editor) {
      return res.status(401).json({ success: false, message: 'Editor not found. Authorization denied.' });
    }

    req.editorId = decoded.id;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token. Authorization denied.' });
      }
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};


// ─────────────────────────────────────────
// Verify Reader OR Writer
// Used for comment and react — both can use same endpoint
// Sets req.readerId or req.writerId depending on who calls
// ─────────────────────────────────────────
export const verifyReaderOrWriter = async (req: Request, res: Response, next: NextFunction) => {
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

    // Check reader first
    const reader = await Reader.findById(decoded.id);
    if (reader) {
      if (!reader.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Email not verified.',
        });
      }
      req.readerId = decoded.id;
      return next();
    }

    // Check writer
    const writer = await Writer.findById(decoded.id);
    if (writer) {
      if (!writer.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Email not verified.',
        });
      }
      req.writerId = decoded.id;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'User not found. Authorization denied.',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token. Authorization denied.' });
      }
    }
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};