import jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN,
} from "../config/env";

interface TokenPayload {
  id: string;
  role: string;
}

const generateTokens = (id: string, role: string = "reader") => {
  const access_token = jwt.sign(
    { id, role },
    JWT_SECRET as string,
    {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );

  const refresh_token = jwt.sign(
    { id, role },
    JWT_REFRESH_SECRET as string,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    }
  );

  return { access_token, refresh_token };
};

const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
};

const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET as string) as TokenPayload;
};

export { generateTokens, verifyAccessToken, verifyRefreshToken };