/**
 * MCP Server Settings component for managing remote MCP servers
 */

import { useState, useCallback, useEffect, type ChangeEvent } from 'react';
import type { McpServerConfig, McpHeader, McpApprovalMode, McpOAuthConfig } from '../../types';
import { MAX_MCP_SERVERS, MCP_APPROVAL_OPTIONS } from '../../types';
import {
  consumePendingMcpOAuthState,
  createEmptyMcpOAuthConfig,
  createMcpOAuthAuthorizationUrl,
  exchangeMcpOAuthCode,
  isMcpOAuthAuthenticated,
  isMcpOAuthConfigured,
  readMcpOAuthCallbackFromUrl,
  refreshMcpOAuthToken,
  removeMcpOAuthCallbackFromHistory,
} from '../../utils/mcpOAuth';
import './McpServerSettings.css';

interface McpServerSettingsProps {
  /** Currently configured MCP servers */
  servers: McpServerConfig[];
  /** Handler to update the servers list */
  onUpdateServers: (servers: McpServerConfig[]) => void;
}

/** Generate a unique ID for a new server or header */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Create an empty server config */
function createEmptyServer(): Omit<McpServerConfig, 'id'> {
  return {
    name: '',
    serverLabel: '',
    serverUrl: '',
    requireApproval: 'never',
    headers: [],
    oauth: createEmptyMcpOAuthConfig(),
    enabled: true,
  };
}

function normalizeOAuthConfig(oauth: McpOAuthConfig | undefined): McpOAuthConfig {
  return { ...createEmptyMcpOAuthConfig(), ...oauth };
}

interface HeaderEditorProps {
  headers: McpHeader[];
  onUpdateHeaders: (headers: McpHeader[]) => void;
}

/**
 * Editor for custom header key-value pairs
 */
function HeaderEditor({ headers, onUpdateHeaders }: HeaderEditorProps) {
  const handleAddHeader = useCallback(() => {
    onUpdateHeaders([...headers, { id: generateId(), key: '', value: '' }]);
  }, [headers, onUpdateHeaders]);

  const handleRemoveHeader = useCallback(
    (index: number) => {
      onUpdateHeaders(headers.filter((_, i) => i !== index));
    },
    [headers, onUpdateHeaders]
  );

  const handleHeaderChange = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      onUpdateHeaders(
        headers.map((header, i) =>
          i === index ? { ...header, [field]: value } : header
        )
      );
    },
    [headers, onUpdateHeaders]
  );

  return (
    <div className="mcp-headers">
      {headers.length === 0 ? (
        <div className="mcp-headers__empty">No custom headers configured</div>
      ) : (
        headers.map((header, index) => (
          <div key={header.id} className="mcp-headers__row">
            <input
              type="text"
              id={`header-key-${header.id}`}
              className="mcp-headers__key"
              value={header.key}
              onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
              placeholder="Header name"
              aria-label="Header name"
            />
            <input
              type="text"
              id={`header-value-${header.id}`}
              className="mcp-headers__value"
              value={header.value}
              onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
              placeholder="Header value"
              aria-label="Header value"
            />
            <button
              type="button"
              className="mcp-headers__remove"
              onClick={() => handleRemoveHeader(index)}
              aria-label="Remove header"
            >
              ✕
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="mcp-headers__add"
        onClick={handleAddHeader}
      >
        + Add Header
      </button>
    </div>
  );
}

interface ServerFormProps {
  server: Omit<McpServerConfig, 'id'>;
  onUpdate: (updates: Partial<Omit<McpServerConfig, 'id'>>) => void;
  /** Unique suffix for form element IDs (for accessibility) */
  formIdSuffix: string;
  onStartOAuthLogin?: () => void;
  onRefreshOAuthToken?: () => void;
  onClearOAuthToken?: () => void;
  oauthStatus?: string;
  isOAuthBusy?: boolean;
}

interface OAuthEditorProps {
  oauth: McpOAuthConfig | undefined;
  onUpdateOAuth: (oauth: McpOAuthConfig) => void;
  onStartLogin?: () => void;
  onRefreshToken?: () => void;
  onClearToken?: () => void;
  status?: string;
  isBusy?: boolean;
}

/**
 * Editor for OAuth authorization settings.
 */
function OAuthEditor({
  oauth,
  onUpdateOAuth,
  onStartLogin,
  onRefreshToken,
  onClearToken,
  status,
  isBusy = false,
}: OAuthEditorProps) {
  const normalizedOAuth = normalizeOAuthConfig(oauth);
  const isConfigured = isMcpOAuthConfigured(normalizedOAuth);
  const isAuthenticated = isMcpOAuthAuthenticated(normalizedOAuth);

  const handleToggleEnabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUpdateOAuth({ ...normalizedOAuth, enabled: e.target.checked });
    },
    [normalizedOAuth, onUpdateOAuth]
  );

  const handleOAuthFieldChange = useCallback(
    (field: 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl') =>
      (e: ChangeEvent<HTMLInputElement>) => {
        onUpdateOAuth({ ...normalizedOAuth, [field]: e.target.value });
      },
    [normalizedOAuth, onUpdateOAuth]
  );

  const handleScopesChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onUpdateOAuth({
        ...normalizedOAuth,
        scopes: e.target.value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean),
      });
    },
    [normalizedOAuth, onUpdateOAuth]
  );

  return (
    <div className="mcp-oauth">
      <label className="mcp-oauth__toggle">
        <input
          type="checkbox"
          checked={normalizedOAuth.enabled}
          onChange={handleToggleEnabled}
        />
        <span>Enable OAuth</span>
      </label>

      {normalizedOAuth.enabled && (
        <div className="mcp-oauth__fields">
          <input
            type="text"
            className="mcp-server-form__input"
            value={normalizedOAuth.clientId}
            onChange={handleOAuthFieldChange('clientId')}
            placeholder="OAuth client ID"
            aria-label="OAuth client ID"
          />
          <input
            type="password"
            className="mcp-server-form__input"
            value={normalizedOAuth.clientSecret}
            onChange={handleOAuthFieldChange('clientSecret')}
            placeholder="OAuth client secret"
            aria-label="OAuth client secret"
          />
          <input
            type="url"
            className="mcp-server-form__input"
            value={normalizedOAuth.authorizationUrl}
            onChange={handleOAuthFieldChange('authorizationUrl')}
            placeholder="https://provider.example.com/oauth/authorize"
            aria-label="OAuth authorization URL"
          />
          <input
            type="url"
            className="mcp-server-form__input"
            value={normalizedOAuth.tokenUrl}
            onChange={handleOAuthFieldChange('tokenUrl')}
            placeholder="https://provider.example.com/oauth/token"
            aria-label="OAuth token URL"
          />
          <textarea
            className="mcp-oauth__scopes"
            value={normalizedOAuth.scopes.join('\n')}
            onChange={handleScopesChange}
            placeholder="OAuth scopes, one per line"
            aria-label="OAuth scopes"
            rows={3}
          />
          <div className="mcp-oauth__actions">
            <button
              type="button"
              className="mcp-oauth__button"
              onClick={onStartLogin}
              disabled={!isConfigured || isBusy || !onStartLogin}
            >
              {isAuthenticated ? 'Reauthorize OAuth' : 'Login with OAuth'}
            </button>
            <button
              type="button"
              className="mcp-oauth__button"
              onClick={onRefreshToken}
              disabled={!normalizedOAuth.refreshToken || isBusy || !onRefreshToken}
            >
              Refresh Token
            </button>
            <button
              type="button"
              className="mcp-oauth__button mcp-oauth__button--danger"
              onClick={onClearToken}
              disabled={!normalizedOAuth.accessToken || isBusy || !onClearToken}
            >
              Clear Token
            </button>
          </div>
          <div className={`mcp-oauth__status ${isAuthenticated ? 'mcp-oauth__status--success' : ''}`}>
            {status ?? (isAuthenticated ? 'OAuth token connected' : 'OAuth token not connected')}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Form fields for editing an MCP server configuration
 */
function ServerForm({
  server,
  onUpdate,
  formIdSuffix,
  onStartOAuthLogin,
  onRefreshOAuthToken,
  onClearOAuthToken,
  oauthStatus,
  isOAuthBusy,
}: ServerFormProps) {
  const handleInputChange = useCallback(
    (field: keyof Omit<McpServerConfig, 'id' | 'headers' | 'enabled' | 'oauth'>) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onUpdate({ [field]: e.target.value });
      },
    [onUpdate]
  );

  const handleApprovalChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onUpdate({ requireApproval: e.target.value as McpApprovalMode });
    },
    [onUpdate]
  );

  const handleHeadersChange = useCallback(
    (headers: McpHeader[]) => {
      onUpdate({ headers });
    },
    [onUpdate]
  );

  const handleOAuthChange = useCallback(
    (oauth: McpOAuthConfig) => {
      onUpdate({ oauth });
    },
    [onUpdate]
  );

  const nameId = `mcp-name-${formIdSuffix}`;
  const labelId = `mcp-label-${formIdSuffix}`;
  const urlId = `mcp-url-${formIdSuffix}`;
  const approvalId = `mcp-approval-${formIdSuffix}`;
  const headersId = `mcp-headers-${formIdSuffix}`;

  return (
    <div className="mcp-server-form">
      <div className="mcp-server-form__field">
        <label className="mcp-server-form__label" htmlFor={nameId}>Display Name</label>
        <input
          type="text"
          id={nameId}
          className="mcp-server-form__input"
          value={server.name}
          onChange={handleInputChange('name')}
          placeholder="My MCP Server"
        />
      </div>

      <div className="mcp-server-form__field">
        <label className="mcp-server-form__label" htmlFor={labelId}>Server Label</label>
        <input
          type="text"
          id={labelId}
          className="mcp-server-form__input"
          value={server.serverLabel}
          onChange={handleInputChange('serverLabel')}
          placeholder="github"
        />
      </div>

      <div className="mcp-server-form__field">
        <label className="mcp-server-form__label" htmlFor={urlId}>Server URL</label>
        <input
          type="url"
          id={urlId}
          className="mcp-server-form__input"
          value={server.serverUrl}
          onChange={handleInputChange('serverUrl')}
          placeholder="https://example.com/mcp"
        />
      </div>

      <div className="mcp-server-form__field">
        <label className="mcp-server-form__label" htmlFor={approvalId}>Tool Approval</label>
        <select
          id={approvalId}
          className="mcp-server-form__select"
          value={server.requireApproval}
          onChange={handleApprovalChange}
        >
          {MCP_APPROVAL_OPTIONS.map((mode) => (
            <option key={mode} value={mode}>
              {mode === 'never' ? 'Never (auto-execute)' : 'Always (require approval)'}
            </option>
          ))}
        </select>
      </div>

      <div className="mcp-server-form__field">
        <label className="mcp-server-form__label" id={headersId}>Custom Headers</label>
        <HeaderEditor
          headers={server.headers}
          onUpdateHeaders={handleHeadersChange}
        />
      </div>

      <div className="mcp-server-form__field">
        <label className="mcp-server-form__label">OAuth</label>
        <OAuthEditor
          oauth={server.oauth}
          onUpdateOAuth={handleOAuthChange}
          onStartLogin={onStartOAuthLogin}
          onRefreshToken={onRefreshOAuthToken}
          onClearToken={onClearOAuthToken}
          status={oauthStatus}
          isBusy={isOAuthBusy}
        />
      </div>
    </div>
  );
}

interface ServerCardProps {
  server: McpServerConfig;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<McpServerConfig>) => void;
  onDelete: () => void;
  onStartOAuthLogin: () => void;
  onRefreshOAuthToken: () => void;
  onClearOAuthToken: () => void;
  oauthStatus?: string;
  isOAuthBusy?: boolean;
}

/**
 * Expandable card for a single MCP server
 */
function ServerCard({
  server,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onStartOAuthLogin,
  onRefreshOAuthToken,
  onClearOAuthToken,
  oauthStatus,
  isOAuthBusy,
}: ServerCardProps) {
  const handleToggleEnabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onUpdate({ enabled: e.target.checked });
    },
    [onUpdate]
  );

  const handleFormUpdate = useCallback(
    (updates: Partial<Omit<McpServerConfig, 'id'>>) => {
      onUpdate(updates);
    },
    [onUpdate]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete]
  );

  return (
    <div
      className={`mcp-server-card ${isExpanded ? 'mcp-server-card--expanded' : ''}`}
    >
      <div className="mcp-server-card__header" onClick={onToggleExpand}>
        <input
          type="checkbox"
          className="mcp-server-card__toggle"
          checked={server.enabled}
          onChange={handleToggleEnabled}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Enable ${server.name || 'server'}`}
        />
        <span
          className={`mcp-server-card__name ${!server.enabled ? 'mcp-server-card__name--disabled' : ''}`}
        >
          {server.name || 'Unnamed Server'}
        </span>
        <button
          type="button"
          className={`mcp-server-card__expand ${isExpanded ? 'mcp-server-card__expand--expanded' : ''}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          ▼
        </button>
        <button
          type="button"
          className="mcp-server-card__delete"
          onClick={handleDeleteClick}
          aria-label="Delete server"
        >
          🗑
        </button>
      </div>
      {isExpanded && (
        <ServerForm
          server={server}
          onUpdate={handleFormUpdate}
          formIdSuffix={server.id}
          onStartOAuthLogin={onStartOAuthLogin}
          onRefreshOAuthToken={onRefreshOAuthToken}
          onClearOAuthToken={onClearOAuthToken}
          oauthStatus={oauthStatus}
          isOAuthBusy={isOAuthBusy}
        />
      )}
    </div>
  );
}

/**
 * Main MCP Server Settings component
 */
export function McpServerSettings({
  servers,
  onUpdateServers,
}: McpServerSettingsProps) {
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [oauthStatuses, setOauthStatuses] = useState<Record<string, string>>({});
  const [busyOAuthServerId, setBusyOAuthServerId] = useState<string | null>(null);
  const [newServer, setNewServer] = useState<Omit<McpServerConfig, 'id'>>(
    createEmptyServer()
  );

  const canAddMore = servers.length < MAX_MCP_SERVERS;

  const handleToggleExpand = useCallback((serverId: string) => {
    setExpandedServerId((prev) => (prev === serverId ? null : serverId));
  }, []);

  const handleUpdateServer = useCallback(
    (serverId: string, updates: Partial<McpServerConfig>) => {
      onUpdateServers(
        servers.map((s) => (s.id === serverId ? { ...s, ...updates } : s))
      );
    },
    [servers, onUpdateServers]
  );

  const setOAuthStatus = useCallback((serverId: string, status: string) => {
    setOauthStatuses((prev) => ({ ...prev, [serverId]: status }));
  }, []);

  const handleStartOAuthLogin = useCallback(
    async (server: McpServerConfig) => {
      const oauth = normalizeOAuthConfig(server.oauth);
      setBusyOAuthServerId(server.id);
      try {
        const authorizationUrl = await createMcpOAuthAuthorizationUrl(
          server.id,
          oauth,
          window.location.href.split('?')[0].split('#')[0]
        );
        window.location.assign(authorizationUrl);
      } catch (error) {
        setOAuthStatus(
          server.id,
          error instanceof Error ? error.message : 'Failed to start OAuth login.'
        );
        setBusyOAuthServerId(null);
      }
    },
    [setOAuthStatus]
  );

  const handleRefreshOAuthToken = useCallback(
    async (server: McpServerConfig) => {
      const oauth = normalizeOAuthConfig(server.oauth);
      setBusyOAuthServerId(server.id);
      setOAuthStatus(server.id, 'Refreshing OAuth token...');
      try {
        const token = await refreshMcpOAuthToken(oauth);
        handleUpdateServer(server.id, {
          oauth: {
            ...oauth,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            tokenType: token.tokenType,
            expiresAt: token.expiresAt,
          },
        });
        setOAuthStatus(server.id, 'OAuth token refreshed');
      } catch (error) {
        setOAuthStatus(
          server.id,
          error instanceof Error ? error.message : 'Failed to refresh OAuth token.'
        );
      } finally {
        setBusyOAuthServerId(null);
      }
    },
    [handleUpdateServer, setOAuthStatus]
  );

  const handleClearOAuthToken = useCallback(
    (server: McpServerConfig) => {
      const oauth = normalizeOAuthConfig(server.oauth);
      handleUpdateServer(server.id, {
        oauth: {
          ...oauth,
          accessToken: undefined,
          refreshToken: undefined,
          tokenType: undefined,
          expiresAt: undefined,
        },
      });
      setOAuthStatus(server.id, 'OAuth token cleared');
    },
    [handleUpdateServer, setOAuthStatus]
  );

  const handleDeleteServer = useCallback(
    (serverId: string) => {
      onUpdateServers(servers.filter((s) => s.id !== serverId));
      if (expandedServerId === serverId) {
        setExpandedServerId(null);
      }
    },
    [servers, onUpdateServers, expandedServerId]
  );

  const handleStartAddNew = useCallback(() => {
    setIsAddingNew(true);
    setNewServer(createEmptyServer());
    setExpandedServerId(null);
  }, []);

  const handleCancelAddNew = useCallback(() => {
    setIsAddingNew(false);
    setNewServer(createEmptyServer());
  }, []);

  const handleSaveNewServer = useCallback(() => {
    const serverWithId: McpServerConfig = {
      ...newServer,
      id: generateId(),
    };
    onUpdateServers([...servers, serverWithId]);
    setIsAddingNew(false);
    setNewServer(createEmptyServer());
  }, [newServer, servers, onUpdateServers]);

  const handleUpdateNewServer = useCallback(
    (updates: Partial<Omit<McpServerConfig, 'id'>>) => {
      setNewServer((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  useEffect(() => {
    const callback = readMcpOAuthCallbackFromUrl(window.location.href);
    if (!callback) {
      return;
    }

    const pendingState = consumePendingMcpOAuthState(callback.state);
    if (!pendingState) {
      window.history.replaceState(null, '', removeMcpOAuthCallbackFromHistory(window.location.href));
      return;
    }

    if (callback.error) {
      setOAuthStatus(
        pendingState.serverId,
        callback.errorDescription ?? callback.error
      );
      window.history.replaceState(null, '', removeMcpOAuthCallbackFromHistory(window.location.href));
      return;
    }

    if (!callback.code) {
      setOAuthStatus(pendingState.serverId, 'OAuth callback did not include an authorization code.');
      window.history.replaceState(null, '', removeMcpOAuthCallbackFromHistory(window.location.href));
      return;
    }
    const authorizationCode = callback.code;

    const server = servers.find((candidate) => candidate.id === pendingState.serverId);
    if (!server) {
      window.history.replaceState(null, '', removeMcpOAuthCallbackFromHistory(window.location.href));
      return;
    }

    const oauth = normalizeOAuthConfig(server.oauth);
    setBusyOAuthServerId(server.id);
    setOAuthStatus(server.id, 'Completing OAuth login...');

    void (async () => {
      try {
        const token = await exchangeMcpOAuthCode(oauth, authorizationCode, pendingState);
        handleUpdateServer(server.id, {
          oauth: {
            ...oauth,
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            tokenType: token.tokenType,
            expiresAt: token.expiresAt,
          },
        });
        setExpandedServerId(server.id);
        setOAuthStatus(server.id, 'OAuth login complete');
      } catch (error) {
        setOAuthStatus(
          server.id,
          error instanceof Error ? error.message : 'Failed to complete OAuth login.'
        );
      } finally {
        setBusyOAuthServerId(null);
        window.history.replaceState(null, '', removeMcpOAuthCallbackFromHistory(window.location.href));
      }
    })();
  }, [servers, handleUpdateServer, setOAuthStatus]);

  const isNewServerValid =
    newServer.name.trim() !== '' &&
    newServer.serverLabel.trim() !== '' &&
    newServer.serverUrl.trim() !== '';

  return (
    <div className="mcp-servers">
      {servers.length === 0 && !isAddingNew && (
        <div className="mcp-servers__empty">
          No MCP servers configured. Add a server to enable external tool integrations.
        </div>
      )}

      {servers.map((server) => (
        <ServerCard
          key={server.id}
          server={server}
          isExpanded={expandedServerId === server.id}
          onToggleExpand={() => handleToggleExpand(server.id)}
          onUpdate={(updates) => handleUpdateServer(server.id, updates)}
          onDelete={() => handleDeleteServer(server.id)}
          onStartOAuthLogin={() => handleStartOAuthLogin(server)}
          onRefreshOAuthToken={() => handleRefreshOAuthToken(server)}
          onClearOAuthToken={() => handleClearOAuthToken(server)}
          oauthStatus={oauthStatuses[server.id]}
          isOAuthBusy={busyOAuthServerId === server.id}
        />
      ))}

      {isAddingNew && (
        <div className="mcp-server-new">
          <h4 className="mcp-server-new__title">Add New MCP Server</h4>
          <ServerForm server={newServer} onUpdate={handleUpdateNewServer} formIdSuffix="new" />
          <div className="mcp-server-new__actions">
            <button
              type="button"
              className="mcp-server-new__cancel"
              onClick={handleCancelAddNew}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mcp-server-new__save"
              onClick={handleSaveNewServer}
              disabled={!isNewServerValid}
            >
              Add Server
            </button>
          </div>
        </div>
      )}

      {!isAddingNew && (
        <>
          <button
            type="button"
            className="mcp-servers__add-button"
            onClick={handleStartAddNew}
            disabled={!canAddMore}
          >
            + Add MCP Server
          </button>
          {!canAddMore && (
            <span className="mcp-servers__limit-hint">
              Maximum of {MAX_MCP_SERVERS} servers reached
            </span>
          )}
        </>
      )}
    </div>
  );
}
