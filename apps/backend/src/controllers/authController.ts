import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthRequest } from '../middleware/authenticate';

const authService = new AuthService();

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, displayName } = req.body as { email: string; password: string; displayName: string };
    const { user, tokens } = await authService.register(email, password, displayName);
    res.status(201).json({
      data: {
        user: { id: user._id.toString(), email: user.email, displayName: user.displayName },
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    tokens.expiresAt,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'EMAIL_TAKEN') {
      res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Registration failed.' } });
    }
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const { user, tokens } = await authService.login(email, password);
    res.json({
      data: {
        user: { id: user._id.toString(), email: user.email, displayName: user.displayName },
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    tokens.expiresAt,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Login failed.' } });
    }
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const { user, tokens } = await authService.refresh(refreshToken);
    res.json({
      data: {
        userId:       user._id.toString(),
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    tokens.expiresAt,
      },
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === 'INVALID_REFRESH_TOKEN') {
      res.status(401).json({ error: { code: 'INVALID_REFRESH_TOKEN', message: e.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Token refresh failed.' } });
    }
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const userId = (req as AuthRequest).userId;
  await authService.logout(userId);
  res.status(204).send();
}
