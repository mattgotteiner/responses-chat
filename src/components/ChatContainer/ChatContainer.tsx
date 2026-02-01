/**
 * Main chat container component
 */

import { useState, useCallback } from 'react';
import { useSettingsContext } from '../../context/SettingsContext';
import { useChat } from '../../hooks/useChat';
import { SettingsButton } from '../SettingsButton';
import { SettingsSidebar } from '../SettingsSidebar';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import './ChatContainer.css';

/**
 * Main chat container with header, message list, and input
 */
export function ChatContainer() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, updateSettings, isConfigured } = useSettingsContext();
  const { messages, isStreaming, sendMessage, clearConversation } = useChat();

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content, settings);
    },
    [sendMessage, settings]
  );

  const inputPlaceholder = isConfigured
    ? 'Type a message...'
    : 'Configure settings to start chatting...';

  return (
    <div className="chat-container">
      <header className="chat-container__header">
        <h1 className="chat-container__title">Azure OpenAI Chat</h1>
        <SettingsButton onClick={handleOpenSettings} isConfigured={isConfigured} />
      </header>

      <MessageList messages={messages} isConfigured={isConfigured} />

      <ChatInput
        onSendMessage={handleSendMessage}
        onClearConversation={clearConversation}
        disabled={!isConfigured || isStreaming}
        placeholder={inputPlaceholder}
      />

      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}
