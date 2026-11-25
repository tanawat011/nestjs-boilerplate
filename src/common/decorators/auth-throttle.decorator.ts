import { SetMetadata } from '@nestjs/common';

export const AUTH_THROTTLE_KEY = 'authThrottle';

/**
 * Puts a route under the stricter "auth" rate limit (AUTH_THROTTLE_LIMIT
 * requests per minute per client), on top of the default one.
 */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);
