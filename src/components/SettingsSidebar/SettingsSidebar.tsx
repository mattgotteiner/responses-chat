/**
 * Settings sidebar panel
 */

import { useCallback, type ChangeEvent } from 'react';
import type { Settings, ModelName } from '../../types';
import {
  AVAILABLE_MODELS,
  MODEL_REASONING_EFFORTS,
  VERBOSITY_OPTIONS,
  REASONING_SUMMARY_OPTIONS,
} from '../../types';
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
}

/**
 * Slide-in settings panel from the right side
 */
export function SettingsSidebar({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
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
              <span className="settings-field__hint settings-field__hint--warning">
                ⚠️ Stored in browser localStorage (unencrypted). Use only on trusted devices.
              </span>
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
          </section>
        </div>
      </div>
    </div>
  );
}
