import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  consumePendingMcpOAuthState,
  createMcpOAuthAuthorizationUrl,
  exchangeMcpOAuthCode,
  getMcpOAuthAuthorization,
  inferMcpOAuthEndpoints,
  isMcpOAuthAuthenticated,
  readMcpOAuthCallbackFromUrl,
  refreshMcpOAuthToken,
  removeMcpOAuthCallbackFromHistory,
} from './mcpOAuth';
import type { McpOAuthConfig } from '../types';

const oauthConfig: McpOAuthConfig = {
  enabled: true,
  clientId: 'client-id',
  clientSecret: 'client-secret',
  authorizationUrl: 'https://accounts.example.com/oauth/authorize',
  tokenUrl: 'https://accounts.example.com/oauth/token',
  scopes: ['scope.read', 'scope.write'],
};

describe('mcpOAuth', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it('creates an authorization URL and stores pending state', async () => {
    const authorizationUrl = await createMcpOAuthAuthorizationUrl(
      'server-1',
      oauthConfig,
      'https://app.example.com/'
    );
    const url = new URL(authorizationUrl);

    expect(url.origin + url.pathname).toBe('https://accounts.example.com/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/');
    expect(url.searchParams.get('scope')).toBe('scope.read scope.write');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');

    const pendingState = consumePendingMcpOAuthState(url.searchParams.get('state') ?? undefined);
    expect(pendingState).toEqual(expect.objectContaining({
      serverId: 'server-1',
      redirectUri: 'https://app.example.com/',
    }));
  });

  it('parses and removes OAuth callback query parameters', () => {
    const url = 'https://app.example.com/?code=abc&state=xyz&scope=scope.read#/chat';

    expect(readMcpOAuthCallbackFromUrl(url)).toEqual({
      code: 'abc',
      state: 'xyz',
      error: undefined,
      errorDescription: undefined,
    });
    expect(removeMcpOAuthCallbackFromHistory(url)).toBe('/#/chat');
  });

  it('exchanges authorization codes for access tokens', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    })));
    vi.stubGlobal('fetch', fetchMock);

    const token = await exchangeMcpOAuthCode(oauthConfig, 'code-123', {
      serverId: 'server-1',
      state: 'state',
      codeVerifier: 'verifier',
      redirectUri: 'https://app.example.com/',
    });

    expect(token).toEqual(expect.objectContaining({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    }));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://accounts.example.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      })
    );
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = requestInit.body as URLSearchParams;
    expect(requestBody.get('grant_type')).toBe('authorization_code');
    expect(requestBody.get('client_secret')).toBe('client-secret');
    expect(requestBody.get('code_verifier')).toBe('verifier');
  });

  it('refreshes access tokens using the stored refresh token', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      access_token: 'new-access-token',
      expires_in: 1800,
    })));
    vi.stubGlobal('fetch', fetchMock);

    const token = await refreshMcpOAuthToken({
      ...oauthConfig,
      refreshToken: 'refresh-token',
    });

    expect(token.accessToken).toBe('new-access-token');
    expect(token.refreshToken).toBe('refresh-token');
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = requestInit.body as URLSearchParams;
    expect(requestBody.get('grant_type')).toBe('refresh_token');
    expect(requestBody.get('refresh_token')).toBe('refresh-token');
  });

  it('returns authorization only for unexpired authenticated OAuth configs', () => {
    expect(isMcpOAuthAuthenticated({
      ...oauthConfig,
      accessToken: 'access-token',
      expiresAt: Date.now() + 120_000,
    })).toBe(true);
    expect(getMcpOAuthAuthorization({
      ...oauthConfig,
      accessToken: ' access-token ',
      expiresAt: Date.now() + 120_000,
    })).toBe('access-token');
    expect(getMcpOAuthAuthorization({
      ...oauthConfig,
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1,
    })).toBeUndefined();
  });

  it('infers Google OAuth endpoints from Gmail MCP URLs and Google scopes', () => {
    expect(inferMcpOAuthEndpoints('https://gmailmcp.googleapis.com/mcp/v1', [])).toEqual({
      providerName: 'Google',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
    });
    expect(inferMcpOAuthEndpoints('not-yet-a-url', [
      'https://www.googleapis.com/auth/gmail.readonly',
    ])).toEqual({
      providerName: 'Google',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
    });
  });
});
