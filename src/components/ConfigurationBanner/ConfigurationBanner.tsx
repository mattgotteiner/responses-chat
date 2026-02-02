/**
 * Banner component displayed when settings are not configured
 */

import './ConfigurationBanner.css';

interface ConfigurationBannerProps {
  /** Callback when user clicks the configure button */
  onConfigureClick: () => void;
}

/**
 * Warning banner prompting users to configure required settings
 */
export function ConfigurationBanner({ onConfigureClick }: ConfigurationBannerProps) {
  return (
    <div className="configuration-banner" role="alert">
      <span className="configuration-banner__icon" aria-hidden="true">⚠️</span>
      <span className="configuration-banner__text">
        <strong>Settings required:</strong> Enter your Azure OpenAI endpoint and API key to start chatting.
      </span>
      <button
        className="configuration-banner__button"
        onClick={onConfigureClick}
        type="button"
      >
        Open Settings
      </button>
    </div>
  );
}
