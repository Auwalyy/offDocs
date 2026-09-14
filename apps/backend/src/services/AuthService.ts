import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
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
    const user = await User.findOne({ email });
    if (!user) throw Object.assign(new Error('Invalid credentials.'), { code: 'INVALID_CREDENTIALS' });

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw Object.assign(new Error('Invalid credentials.'), { code: 'INVALID_CREDENTIALS' });

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async refresh(rawRefreshToken: string): Promise<{ user: IUser; tokens: TokenPair }> {
    // Find user by verifying the token hash
    const users = await User.find({ refreshTokenHash: { $ne: null } });
    let matchedUser: IUser | null = null;
    for (const u of users) {
      if (u.refreshTokenHash && await argon2.verify(u.refreshTokenHash, rawRefreshToken)) {
        matchedUser = u;
        break;
      }
    }
    if (!matchedUser) throw Object.assign(new Error('Invalid refresh token.'), { code: 'INVALID_REFRESH_TOKEN' });

    const tokens = await this.issueTokens(matchedUser);
    return { user: matchedUser, tokens };
  }

  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }

  private async issueTokens(user: IUser): Promise<TokenPair> {
    const rawRefresh = generateRefreshToken();
    const refreshTokenHash = await argon2.hash(rawRefresh);
    await User.findByIdAndUpdate(user._id, { refreshTokenHash });

    const { token: accessToken, expiresAt } = signAccess(user._id.toString());
    return { accessToken, refreshToken: rawRefresh, expiresAt };
  }
}
