import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { User, IUser } from '../models/User';
import { config } from '../config';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function signAccess(userId: string): { token: string; expiresAt: number } {
  const expiresIn = config.JWT_ACCESS_EXPIRES_IN;
  const token = jwt.sign({ sub: userId }, config.JWT_ACCESS_SECRET, { expiresIn } as jwt.SignOptions);
  // Decode to get actual exp
  const decoded = jwt.decode(token) as { exp: number };
  return { token, expiresAt: decoded.exp * 1000 };
}

/**
 * Refresh tokens have the form `<userId>.<random hex>`. The user id prefix lets
 * us look the user up directly instead of argon2-verifying against every user.
 */
function generateRefreshToken(userId: string): string {
  return `${userId}.${crypto.randomBytes(48).toString('hex')}`;
}

function invalidRefresh() {
  return Object.assign(new Error('Invalid refresh token.'), { code: 'INVALID_REFRESH_TOKEN' });
}

export class AuthService {
  async register(email: string, password: string, displayName: string): Promise<{ user: IUser; tokens: TokenPair }> {
    const existing = await User.findOne({ email });
    if (existing) throw Object.assign(new Error('Email already registered.'), { code: 'EMAIL_TAKEN' });

    const passwordHash = await argon2.hash(password);
    const user = await User.create({ email, passwordHash, displayName });

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: IUser; tokens: TokenPair }> {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw Object.assign(new Error('Invalid email or password.'), { code: 'INVALID_CREDENTIALS' });

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw Object.assign(new Error('Invalid email or password.'), { code: 'INVALID_CREDENTIALS' });

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async refresh(rawRefreshToken: string): Promise<{ user: IUser; tokens: TokenPair }> {
    const [userId] = rawRefreshToken.split('.');
    if (!userId || !Types.ObjectId.isValid(userId)) throw invalidRefresh();

    const user = await User.findById(userId);
    if (!user?.refreshTokenHash) throw invalidRefresh();

    const valid = await argon2.verify(user.refreshTokenHash, rawRefreshToken);
    if (!valid) throw invalidRefresh();

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }

  private async issueTokens(user: IUser): Promise<TokenPair> {
    const userId = user._id.toString();
    const rawRefresh = generateRefreshToken(userId);
    const refreshTokenHash = await argon2.hash(rawRefresh);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash });

    const { token: accessToken, expiresAt } = signAccess(userId);
    return { accessToken, refreshToken: rawRefresh, expiresAt };
  }
}
