import { cookies } from 'next/headers';
import { verifyToken } from './jwt';
import { JWTPayload } from './types';

/**
 * Retrieves the current logged-in user from the HTTP-only cookie.
 * Returns the decoded JWTPayload or null if not authenticated.
 */
export async function currentUser(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return null;
    }
    return await verifyToken(token);
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}
