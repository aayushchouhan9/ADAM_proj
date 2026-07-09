import { SignJWT, jwtVerify } from 'jose';
import { JWTPayload } from './types';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('WARNING: JWT_SECRET environment variable is missing or too short (needs to be >= 32 characters). Using a fallback secret.');
}

const secretKey = new TextEncoder().encode(
  JWT_SECRET || 'default_super_secret_jwt_secret_key_at_least_32_characters_long'
);

/**
 * Signs a JWT token with a 2-hour expiration time using HS256 algorithm.
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  // Convert custom payload into a plain object to satisfy jose requirements
  const josePayload = { ...payload } as any;
  
  return await new SignJWT(josePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secretKey);
}

/**
 * Verifies a JWT token and returns the decoded payload, or null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}
