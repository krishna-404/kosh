import { env } from "@frontend/configs/env.config";
import { createORPCClient, onError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { SimpleCsrfProtectionLinkPlugin } from '@orpc/client/plugins';
import { toast } from 'react-toastify';
import type { UserAppRouter, UserAppRouterInputs, UserAppRouterOutputs } from "../../../backend/src/routers/user_app/user_app.router";
import { signout } from './signout.utils';

interface ClientContext {
  something?: string
}

// When VITE_API_URL is empty (Dokploy same-origin reverse-proxy deploy), we
// must resolve against the current origin ourselves. Passing a relative path
// like "/api/user-app" here works for `fetch`, but oRPC's RPCLink internally
// does `new URL(path, this.url)` which throws "Invalid URL" on a relative
// base — breaking every RPC call with "Failed to construct 'URL': Invalid URL".
const orpcBaseUrl = env.VITE_API_URL
  ? `${env.VITE_API_URL}/api/user-app`
  : `${globalThis.location.origin}/api/user-app`;

const link = new RPCLink<ClientContext>({
  url: orpcBaseUrl,
  headers: ({ context }) => {
    const headers: Record<string, string> = {
      Authorization: 'Bearer token',
    };
    if (context.something) headers['x-api-key'] = context.something;
    return headers;
  },
  fetch: (request, init) =>
    globalThis.fetch(request, {
      ...init,
      credentials: 'include' as const, // Include cookies for cross-origin requests
    }),
  interceptors: [
    onError(async (error) => {
      // Extract error info
      const err = error as { message?: string; status?: number; code?: string; path?: string; name?: string; cause?: { name?: string; message?: string } };
      const errorMessage = err.message || "An unexpected error occurred";

      // Abort detection has to cover three shapes:
      //   1. Raw AbortError from fetch → err.name === "AbortError"
      //   2. Message contains the abort phrasing directly (older SDK behaviour)
      //   3. oRPC wraps aborts as "Cannot parse response body..." with the real
      //      AbortError on err.cause — most common shape in prod. Without the
      //      cause check, every navigation-cancelled request logs as an error.
      const causeName = err.cause?.name;
      const causeMessage = err.cause?.message ?? "";
      const isAbort =
        err.name === "AbortError" ||
        causeName === "AbortError" ||
        errorMessage.includes("signal is aborted") ||
        errorMessage.includes("stream closed") ||
        errorMessage.includes("aborted a request") ||
        causeMessage.includes("aborted a request") ||
        causeMessage.includes("signal is aborted");
      if (isAbort) {
        console.debug("[oRPC] Request aborted or stream closed (expected during navigation)");
        return;
      };
      
      // Check if this is an authentication error (401)
      const isAuthError = 
        err.status === 401 ||
        errorMessage.toLowerCase().includes("unauthenticated") ||
        errorMessage.toLowerCase().includes("authentication required");
      
      console.error("[oRPC Error]", err);

      // For auth errors, sign out and send the user back to login.
      if (isAuthError) {
        toast.error("Your session has expired. Please log in again.", { autoClose: 3000 });
        await signout();
      }
    })
  ],
  plugins: [
     new SimpleCsrfProtectionLinkPlugin(),
  ]
})

export const orpcFetch: UserAppRouter = createORPCClient(link);

// Dev-only console helper. Lets you drive any oRPC endpoint from browser
// DevTools while iterating on features. Example:
//   await __orpc.notifications.testSendPush({ title: 'Hi', body: 'test' })
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __orpc: UserAppRouter }).__orpc = orpcFetch;
}

/**
 * @public
 */
export type UserAppBackendInputs = UserAppRouterInputs;
/**
 * @public
 */
export type UserAppBackendOutputs = UserAppRouterOutputs;
