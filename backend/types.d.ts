import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        user_id: string;
        email?: string;
        role?: string;
        user_type?: string;
      };
    }
  }
}

export interface DecodedToken extends JwtPayload {
  user_id: string;
  email?: string;
  role?: string;
}
