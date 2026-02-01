/**
 * Main chat container component
 */

import { useState, useCallback, useMemo } from 'react';
import { useSettingsContext } from '../../context/SettingsContext';
import { useChat } from '../../hooks/useChat';
import { SettingsButton } from '../SettingsButton';
import { SettingsSidebar } from '../SettingsSidebar';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import { JsonSidePanel, type JsonPanelData } from '../JsonSidePanel';
import { calculateConversationUsage } from '../../utils/tokenUsage';
import './ChatContainer.css';

/**
 * Main chat container with header, message list, and input
 */
export function ChatContainer() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [jsonPanelData, setJsonPanelData] = useState<JsonPanelData | null>(null);
  const { settings, updateSettings, isConfigured } = useSettingsContext();
  const { messages, isStreaming, sendMessage, stopStreaming, clearConversation } = useChat();

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenJsonPanel = useCallback((data: JsonPanelData) => {
    setJsonPanelData(data);
  }, []);

  const handleCloseJsonPanel = useCallback(() => {
    setJsonPanelData(null);
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

  // Calculate total token usage across all messages
  const conversationUsage = useMemo(
    () => calculateConversationUsage(messages),
    [messages]
  );

  return (
    <div className="chat-container">
      <header className="chat-container__header">
        <h1 className="chat-container__title">Azure OpenAI Chat</h1>
        <SettingsButton onClick={handleOpenSettings} isConfigured={isConfigured} />
      </header>

      <MessageList
        messages={messages}
        isConfigured={isConfigured}
        onOpenJsonPanel={handleOpenJsonPanel}
      />

      <ChatInput
        onSendMessage={handleSendMessage}
        onClearConversation={clearConversation}
        onStopStreaming={stopStreaming}
        isStreaming={isStreaming}
        disabled={!isConfigured || isStreaming}
        placeholder={inputPlaceholder}
        tokenUsage={conversationUsage}
      />

      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      <JsonSidePanel
        isOpen={jsonPanelData !== null}
        onClose={handleCloseJsonPanel}
        panelData={jsonPanelData}
      />
    </div>
  );
}
