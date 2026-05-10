import type { McpOAuthConfig } from '../types';

const OAUTH_STATE_STORAGE_PREFIX = 'mcp-oauth-state:';
const TOKEN_EXPIRY_SKEW_MS = 60_000;

export interface PendingMcpOAuthState {
  serverId: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface McpOAuthCallback {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface McpOAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

function isOAuthTokenResponse(value: unknown): value is OAuthTokenResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record['access_token'] === 'string' &&
    (record['refresh_token'] === undefined || typeof record['refresh_token'] === 'string') &&
    (record['token_type'] === undefined || typeof record['token_type'] === 'string') &&
    (record['expires_in'] === undefined || typeof record['expires_in'] === 'number')
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function getStateStorageKey(serverId: string): string {
  return `${OAUTH_STATE_STORAGE_PREFIX}${serverId}`;
}

function readTokenError(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const error = typeof record['error'] === 'string' ? record['error'] : undefined;
  const description =
    typeof record['error_description'] === 'string' ? record['error_description'] : undefined;

  if (error && description) {
    return `${error}: ${description}`;
  }

  return error ?? description;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) {
    return response.statusText;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return readTokenError(parsed) ?? text;
  } catch {
    return text;
  }
}

export function createEmptyMcpOAuthConfig(): McpOAuthConfig {
  return {
    enabled: false,
    clientId: '',
    clientSecret: '',
    authorizationUrl: '',
    tokenUrl: '',
    scopes: [],
  };
}

export function isMcpOAuthConfigured(oauth: McpOAuthConfig | undefined): boolean {
  return Boolean(
    oauth?.enabled &&
    oauth.clientId.trim() &&
    oauth.clientSecret.trim() &&
    oauth.authorizationUrl.trim() &&
    oauth.tokenUrl.trim()
  );
}

export function isMcpOAuthAuthenticated(oauth: McpOAuthConfig | undefined): boolean {
  return Boolean(
    oauth?.enabled &&
    oauth.accessToken?.trim() &&
    (oauth.expiresAt === undefined || oauth.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS)
  );
}

export function getMcpOAuthAuthorization(oauth: McpOAuthConfig | undefined): string | undefined {
  if (!isMcpOAuthAuthenticated(oauth)) {
    return undefined;
  }

  return oauth?.accessToken?.trim();
}

export async function createMcpOAuthAuthorizationUrl(
  serverId: string,
  oauth: McpOAuthConfig,
  redirectUri: string
): Promise<string> {
  if (!isMcpOAuthConfigured(oauth)) {
    throw new Error('OAuth client ID, client secret, authorization URL, and token URL are required.');
  }

  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const authorizationUrl = new URL(oauth.authorizationUrl);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('client_id', oauth.clientId.trim());
  authorizationUrl.searchParams.set('redirect_uri', redirectUri);
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');

  const scope = oauth.scopes.map((scopeValue) => scopeValue.trim()).filter(Boolean).join(' ');
  if (scope) {
    authorizationUrl.searchParams.set('scope', scope);
  }

  const pendingState: PendingMcpOAuthState = {
    serverId,
    state,
    codeVerifier,
    redirectUri,
  };
  sessionStorage.setItem(getStateStorageKey(serverId), JSON.stringify(pendingState));

  return authorizationUrl.toString();
}

export function readMcpOAuthCallbackFromUrl(url: string): McpOAuthCallback | null {
  const parsedUrl = new URL(url);
  const params = parsedUrl.searchParams;
  const code = params.get('code') ?? undefined;
  const state = params.get('state') ?? undefined;
  const error = params.get('error') ?? undefined;
  const errorDescription = params.get('error_description') ?? undefined;

  if (!code && !error) {
    return null;
  }

  return { code, state, error, errorDescription };
}

export function consumePendingMcpOAuthState(state: string | undefined): PendingMcpOAuthState | null {
  if (!state) {
    return null;
  }

  for (let index = 0; index < sessionStorage.length; index += 1) {
    const key = sessionStorage.key(index);
    if (!key?.startsWith(OAUTH_STATE_STORAGE_PREFIX)) {
      continue;
    }

    const storedValue = sessionStorage.getItem(key);
    if (!storedValue) {
      continue;
    }

    try {
      const parsed = JSON.parse(storedValue) as PendingMcpOAuthState;
      if (parsed.state === state) {
        sessionStorage.removeItem(key);
        return parsed;
      }
    } catch {
      sessionStorage.removeItem(key);
    }
  }

  return null;
}

export function removeMcpOAuthCallbackFromHistory(url: string): string {
  const parsedUrl = new URL(url);
  for (const key of ['code', 'state', 'scope', 'authuser', 'prompt', 'error', 'error_description']) {
    parsedUrl.searchParams.delete(key);
  }

  return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
}

export async function exchangeMcpOAuthCode(
  oauth: McpOAuthConfig,
  code: string,
  pendingState: PendingMcpOAuthState
): Promise<McpOAuthTokenResult> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: pendingState.redirectUri,
    client_id: oauth.clientId.trim(),
    client_secret: oauth.clientSecret.trim(),
    code_verifier: pendingState.codeVerifier,
  });

  const response = await fetch(oauth.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${await readErrorMessage(response)}`);
  }

  const payload = await response.json() as unknown;
  if (!isOAuthTokenResponse(payload)) {
    throw new Error('OAuth token exchange response did not include an access token.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    expiresAt:
      payload.expires_in === undefined
        ? undefined
        : Date.now() + Math.max(0, payload.expires_in * 1000),
  };
}

export async function refreshMcpOAuthToken(oauth: McpOAuthConfig): Promise<McpOAuthTokenResult> {
  if (!oauth.refreshToken) {
    throw new Error('No refresh token is available for this MCP server.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: oauth.refreshToken,
    client_id: oauth.clientId.trim(),
    client_secret: oauth.clientSecret.trim(),
  });

  const response = await fetch(oauth.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token refresh failed: ${await readErrorMessage(response)}`);
  }

  const payload = await response.json() as unknown;
  if (!isOAuthTokenResponse(payload)) {
    throw new Error('OAuth token refresh response did not include an access token.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? oauth.refreshToken,
    tokenType: payload.token_type,
    expiresAt:
      payload.expires_in === undefined
        ? undefined
        : Date.now() + Math.max(0, payload.expires_in * 1000),
  };
}
