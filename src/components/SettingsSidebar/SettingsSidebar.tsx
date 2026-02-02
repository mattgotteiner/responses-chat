/**
 * Settings sidebar panel
 */

import { useCallback, type ChangeEvent } from 'react';
import type { Settings, ModelName, McpServerConfig } from '../../types';
import {
  AVAILABLE_MODELS,
  MODEL_REASONING_EFFORTS,
  VERBOSITY_OPTIONS,
  REASONING_SUMMARY_OPTIONS,
  MESSAGE_RENDER_MODE_OPTIONS,
  THEME_OPTIONS,
  DEFAULT_SETTINGS,
} from '../../types';
import { McpServerSettings } from '../McpServerSettings';
import './SettingsSidebar.css';

/** Handler type for checkbox change events */
type CheckboxChangeHandler = (field: keyof Settings) => (e: ChangeEvent<HTMLInputElement>) => void;

interface SettingsSidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Handler to close the sidebar */
  onClose: () => void;
  /** Current settings */
  settings: Settings;
  /** Handler to update settings */
  onUpdateSettings: (updates: Partial<Settings>) => void;
  /** Handler to clear all stored data */
  onClearStoredData?: () => void;
}

/**
 * Slide-in settings panel from the right side
 */
export function SettingsSidebar({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearStoredData,
}: SettingsSidebarProps) {
  const availableReasoningEfforts = MODEL_REASONING_EFFORTS[settings.modelName];

  const handleInputChange = useCallback(
    (field: keyof Settings) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      onUpdateSettings({ [field]: value || undefined });
    },
    [onUpdateSettings]
  );

  const handleCheckboxChange: CheckboxChangeHandler = useCallback(
    (field: keyof Settings) => (e: ChangeEvent<HTMLInputElement>) => {
      onUpdateSettings({ [field]: e.target.checked });
    },
    [onUpdateSettings]
  );

  const handleSliderChange = useCallback(
    (field: keyof Settings) => (e: ChangeEvent<HTMLInputElement>) => {
      const parsed = parseInt(e.target.value, 10);
      if (!isNaN(parsed)) {
        onUpdateSettings({ [field]: parsed });
      }
    },
    [onUpdateSettings]
  );

  const handleMcpServersChange = useCallback(
    (servers: McpServerConfig[]) => {
      onUpdateSettings({ mcpServers: servers });
    },
    [onUpdateSettings]
  );

  const handleModelChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newModel = e.target.value as ModelName;
      const newAvailableEfforts = MODEL_REASONING_EFFORTS[newModel];

      // Reset reasoning effort if current one is not available for new model
      const updates: Partial<Settings> = { modelName: newModel };
      if (
        settings.reasoningEffort &&
        !newAvailableEfforts.includes(settings.reasoningEffort)
      ) {
        updates.reasoningEffort = undefined;
      }

      onUpdateSettings(updates);
    },
    [settings.reasoningEffort, onUpdateSettings]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return <></>;
  }

  return (
    <div className="settings-overlay" onClick={handleOverlayClick}>
      <div className="settings-sidebar">
        <div className="settings-sidebar__header">
          <h2 className="settings-sidebar__title">Settings</h2>
          <button
            className="settings-sidebar__close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="settings-sidebar__content">
          {/* Storage Settings */}
          <section className="settings-section settings-section--storage">
            <h3 className="settings-section__title">Storage</h3>

            <div className="settings-field">
              <label className="settings-field__checkbox-wrapper">
                <input
                  id="noLocalStorage"
                  type="checkbox"
                  className="settings-field__checkbox"
                  checked={settings.noLocalStorage || false}
                  onChange={handleCheckboxChange('noLocalStorage')}
                />
                <span className="settings-field__checkbox-label">Don't save settings</span>
              </label>
              <span className="settings-field__hint">
                When enabled, settings are not saved and must be re-entered each session.
              </span>
            </div>
          </section>

          {/* Appearance Settings */}
          <section className="settings-section">
            <h3 className="settings-section__title">Appearance</h3>

            <div className="settings-field">
              <span className="settings-field__label">Theme</span>
              <div className="settings-field__radio-group">
                {THEME_OPTIONS.map((theme) => (
                  <label key={theme} className="settings-field__radio-wrapper">
                    <input
                      type="radio"
                      name="theme"
                      className="settings-field__radio"
                      value={theme}
                      checked={settings.theme === theme}
                      onChange={() => onUpdateSettings({ theme })}
                    />
                    <span className="settings-field__radio-label">
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Required Settings */}
          <section className="settings-section">
            <h3 className="settings-section__title">Required</h3>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="endpoint">
                Endpoint URL
              </label>
              <input
                id="endpoint"
                type="url"
                className="settings-field__input"
                value={settings.endpoint}
                onChange={handleInputChange('endpoint')}
                placeholder="https://your-resource.openai.azure.com"
              />
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="apiKey">
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                className="settings-field__input"
                value={settings.apiKey}
                onChange={handleInputChange('apiKey')}
                placeholder="Enter your API key"
              />
              {settings.noLocalStorage ? (
                <span className="settings-field__hint">
                  Storage disabled — credentials will not be saved.
                </span>
              ) : (
                <span className="settings-field__hint settings-field__hint--warning">
                  ⚠️ Stored in browser localStorage (unencrypted). Use only on trusted devices.
                </span>
              )}
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="modelName">
                Model
              </label>
              <select
                id="modelName"
                className="settings-field__select"
                value={settings.modelName}
                onChange={handleModelChange}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="deploymentName">
                Deployment Name
              </label>
              <input
                id="deploymentName"
                type="text"
                className="settings-field__input"
                value={settings.deploymentName}
                onChange={handleInputChange('deploymentName')}
                placeholder={settings.modelName}
              />
              <span className="settings-field__hint">
                Defaults to model name if empty
              </span>
            </div>
          </section>

          {/* Tools Settings */}
          <section className="settings-section">
            <h3 className="settings-section__title">Tools</h3>

            <div className="settings-field">
              <label className="settings-field__checkbox-wrapper">
                <input
                  id="webSearchEnabled"
                  type="checkbox"
                  className="settings-field__checkbox"
                  checked={settings.webSearchEnabled || false}
                  onChange={handleCheckboxChange('webSearchEnabled')}
                />
                <span className="settings-field__checkbox-label">Web Search</span>
              </label>
              <span className="settings-field__hint">
                Ground responses with real-time web data via Bing. Incurs additional costs.
              </span>
            </div>

            <div className="settings-field">
              <label className="settings-field__checkbox-wrapper">
                <input
                  id="codeInterpreterEnabled"
                  type="checkbox"
                  className="settings-field__checkbox"
                  checked={settings.codeInterpreterEnabled || false}
                  onChange={handleCheckboxChange('codeInterpreterEnabled')}
                />
                <span className="settings-field__checkbox-label">Code Interpreter</span>
              </label>
              <span className="settings-field__hint">
                Execute Python code in a sandboxed environment. Incurs additional costs.
              </span>
            </div>
          </section>

          {/* MCP Servers */}
          <section className="settings-section">
            <h3 className="settings-section__title">MCP Servers</h3>
            <span className="settings-field__hint" style={{ marginBottom: '12px', display: 'block' }}>
              Connect to remote Model Context Protocol (MCP) servers to extend model capabilities.
            </span>
            <McpServerSettings
              servers={settings.mcpServers || []}
              onUpdateServers={handleMcpServersChange}
            />
          </section>

          {/* Optional Settings */}
          <section className="settings-section">
            <h3 className="settings-section__title">Optional</h3>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="reasoningEffort">
                Reasoning Effort
              </label>
              <select
                id="reasoningEffort"
                className="settings-field__select"
                value={settings.reasoningEffort || ''}
                onChange={handleInputChange('reasoningEffort')}
              >
                <option value="">Default</option>
                {availableReasoningEfforts.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="reasoningSummary">
                Reasoning Summary
              </label>
              <select
                id="reasoningSummary"
                className="settings-field__select"
                value={settings.reasoningSummary || ''}
                onChange={handleInputChange('reasoningSummary')}
              >
                <option value="">Default</option>
                {REASONING_SUMMARY_OPTIONS.map((summary) => (
                  <option key={summary} value={summary}>
                    {summary}
                  </option>
                ))}
              </select>
              <span className="settings-field__hint">
                Set to "detailed" for reasoning to appear in stream
              </span>
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="verbosity">
                Verbosity
              </label>
              <select
                id="verbosity"
                className="settings-field__select"
                value={settings.verbosity || ''}
                onChange={handleInputChange('verbosity')}
              >
                <option value="">Default</option>
                {VERBOSITY_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="developerInstructions">
                Developer Instructions
              </label>
              <textarea
                id="developerInstructions"
                className="settings-field__textarea"
                value={settings.developerInstructions || ''}
                onChange={handleInputChange('developerInstructions')}
                placeholder="System prompt / developer instructions..."
                rows={4}
              />
            </div>

            <div className="settings-field">
              <label className="settings-field__label" htmlFor="messageRenderMode">
                Message Render Mode
              </label>
              <select
                id="messageRenderMode"
                className="settings-field__select"
                value={settings.messageRenderMode}
                onChange={handleInputChange('messageRenderMode')}
              >
                {MESSAGE_RENDER_MODE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode === 'markdown' ? 'Markdown (rendered)' : 
                     mode === 'plaintext' ? 'Plain Text' : 
                     'Code Block'}
                  </option>
                ))}
              </select>
              <span className="settings-field__hint">
                How assistant messages are displayed. Can be overridden per message.
              </span>
            </div>
          </section>

          {/* API Limits */}
          <section className="settings-section">
            <h3 className="settings-section__title">API Limits</h3>

            <div className="settings-field">
              <label className="settings-field__checkbox-wrapper">
                <input
                  id="maxOutputTokensEnabled"
                  type="checkbox"
                  className="settings-field__checkbox"
                  checked={settings.maxOutputTokensEnabled || false}
                  onChange={handleCheckboxChange('maxOutputTokensEnabled')}
                />
                <span className="settings-field__checkbox-label">Limit Max Output Tokens</span>
              </label>
              <span className="settings-field__hint">
                When disabled, no limit is sent (null). Enable to set a specific limit.
              </span>
            </div>

            {settings.maxOutputTokensEnabled && (
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="maxOutputTokens">
                  Max Output Tokens: {(settings.maxOutputTokens ?? DEFAULT_SETTINGS.maxOutputTokens!).toLocaleString()}
                </label>
                <input
                  id="maxOutputTokens"
                  type="range"
                  className="settings-field__slider"
                  value={settings.maxOutputTokens ?? DEFAULT_SETTINGS.maxOutputTokens}
                  onChange={handleSliderChange('maxOutputTokens')}
                  min="1000"
                  max="128000"
                  step="1000"
                />
                <div className="settings-field__slider-labels">
                  <span>1K</span>
                  <span>128K</span>
                </div>
              </div>
            )}
          </section>

          {/* Clear Data */}
          <section className="settings-section settings-section--clear">
            <div className="settings-field">
              <button
                type="button"
                className="settings-storage__clear-btn"
                onClick={onClearStoredData}
              >
                Clear Saved Data
              </button>
              <span className="settings-field__hint">
                Remove all saved settings from this browser.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
