import type { HookResponse } from '../cli/types.js';

/** Standard hook response — always continue, suppress output */
export const STANDARD_HOOK_RESPONSE: HookResponse = {
  continue: true,
  suppressOutput: true,
};

/** Context injection response */
export function contextResponse(message: string): HookResponse {
  return {
    continue: true,
    suppressOutput: true,
    message,
  };
}

/** Error response — continue but with error status */
export function errorResponse(reason: string): HookResponse {
  return {
    continue: true,
    suppressOutput: true,
    status: 'error',
    reason,
  };
}
