/**
 * Main chat container component
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSettingsContext } from '../../context/SettingsContext';
import { useChat } from '../../hooks/useChat';
import { useThreads } from '../../hooks/useThreads';
import { SettingsButton } from '../SettingsButton';
import { SettingsSidebar } from '../SettingsSidebar';
import { HistorySidebar } from '../HistorySidebar';
import { MessageList } from '../MessageList';
import { ChatInput } from '../ChatInput';
import { ConfigurationBanner } from '../ConfigurationBanner';
import { JsonSidePanel, type JsonPanelData } from '../JsonSidePanel';
import { calculateConversationUsage } from '../../utils/tokenUsage';
import { generateThreadTitle } from '../../utils/titleGeneration';
import { createAzureClient } from '../../utils/api';
import type { Attachment } from '../../types';
import './ChatContainer.css';

/**
 * Main chat container with header, message list, and input
 */
export function ChatContainer() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [jsonPanelData, setJsonPanelData] = useState<JsonPanelData | null>(null);
  const { settings, updateSettings, clearStoredData, isConfigured, vectorStoreCache, setVectorStores, setStoreFiles, setStoreFilesLoading } = useSettingsContext();
  const { messages, isStreaming, sendMessage, stopStreaming, clearConversation, handleMcpApproval, retryMessage, loadThread, detachStream, reattachStream, previousResponseId } = useChat();
  const {
    threads,
    activeThreadId,
    isLoading: threadsLoading,
    isEphemeral,
    createThread,
    deleteThread,
    switchThread,
    updateThread,
    updateThreadTitle,
    startNewChat,
    startEphemeral,
    clearAllThreads,
  } = useThreads();

  // Track whether we've generated a title for the active thread
  const titleGeneratedRef = useRef<string | null>(null);
  // Track the previous message count to detect new assistant replies
  const prevMessageCountRef = useRef(0);
  // Track which thread IDs have a stream running in the background
  const [backgroundStreamingThreadIds, setBackgroundStreamingThreadIds] = useState<Set<string>>(new Set());
  // Guard: ensure the restore-on-load logic runs at most once
  const hasRestoredRef = useRef(false);

  // Restore the active thread once IndexedDB has finished loading
  useEffect(() => {
    if (threadsLoading || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (activeThreadId) {
      const thread = threads.find((t) => t.id === activeThreadId);
      if (thread) {
        loadThread(thread.messages, thread.previousResponseId);
        prevMessageCountRef.current = thread.messages.length;
        titleGeneratedRef.current = activeThreadId;
      } else {
        startNewChat(); // stored ID no longer valid
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsLoading]); // runs once when the async IDB load completes

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleOpenHistory = useCallback(() => {
    setIsHistoryOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setIsHistoryOpen(false);
  }, []);

  const handleOpenJsonPanel = useCallback((data: JsonPanelData) => {
    setJsonPanelData(data);
  }, []);

  const handleCloseJsonPanel = useCallback(() => {
    setJsonPanelData(null);
  }, []);

  const handleSendMessage = useCallback(
    (content: string, attachments?: Attachment[]) => {
      sendMessage(content, settings, attachments);
    },
    [sendMessage, settings]
  );

  const handleMcpApprove = useCallback(
    (approvalRequestId: string) => {
      handleMcpApproval(approvalRequestId, true, settings);
    },
    [handleMcpApproval, settings]
  );

  const handleMcpDeny = useCallback(
    (approvalRequestId: string) => {
      handleMcpApproval(approvalRequestId, false, settings);
    },
    [handleMcpApproval, settings]
  );

  const handleRetry = useCallback(
    (messageId: string) => {
      retryMessage(messageId, settings);
    },
    [retryMessage, settings]
  );

  const handleSwitchThread = useCallback(
    (id: string) => {
      // Re-attach if the user is switching back to a background-streaming thread
      if (backgroundStreamingThreadIds.has(id)) {
        const buffer = reattachStream(id);
        setBackgroundStreamingThreadIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (buffer) {
          // Trick auto-save effect: make count appear lower so it fires when stream completes
          prevMessageCountRef.current = buffer.length - 1;
        }
        switchThread(id); // update activeThreadId; ignore returned messages (buffer is current)
        titleGeneratedRef.current = id;
        return;
      }

      // Detach an in-flight foreground stream so it keeps running in the background
      if (isStreaming && !isEphemeral) {
        let targetThreadId = activeThreadId;
        if (!targetThreadId) {
          targetThreadId = createThread(messages, previousResponseId);
        }
        const threadIdForCallback = targetThreadId;
        detachStream(threadIdForCallback, messages, (finalMessages, finalPrevResponseId) => {
          updateThread(threadIdForCallback, finalMessages, finalPrevResponseId);
          setBackgroundStreamingThreadIds((prev) => {
            const next = new Set(prev);
            next.delete(threadIdForCallback);
            return next;
          });
        });
        setBackgroundStreamingThreadIds((prev) => new Set([...prev, threadIdForCallback]));
      }

      const data = switchThread(id);
      if (data) {
        loadThread(data.messages, data.previousResponseId);
        // Reset count to the new thread's size so the auto-save effect doesn't
        // misfire against this thread when the background stream eventually sets
        // isStreaming=false and causes a re-run with a stale prevMessageCountRef.
        prevMessageCountRef.current = data.messages.length;
        titleGeneratedRef.current = id;
      }
    },
    [switchThread, loadThread, detachStream, reattachStream, isStreaming, isEphemeral, activeThreadId, updateThread, createThread, messages, previousResponseId, backgroundStreamingThreadIds]
  );

  const handleDeleteThread = useCallback(
    (id: string) => {
      if (id === activeThreadId) {
        clearConversation();
        prevMessageCountRef.current = 0;
      }
      deleteThread(id);
    },
    [deleteThread, activeThreadId, clearConversation]
  );

  const handleNewChat = useCallback(() => {
    // If a stream is running, detach it to background so the response is saved when complete.
    // With early thread creation, activeThreadId is almost always set by the time streaming
    // starts — but we guard for the rare race where the effect hasn't fired yet.
    if (isStreaming && !isEphemeral) {
      if (activeThreadId) {
        detachStream(activeThreadId, messages, (finalMessages, finalPrevResponseId) => {
          updateThread(activeThreadId, finalMessages, finalPrevResponseId);
        });
      } else {
        stopStreaming();
      }
    }
    clearConversation();
    prevMessageCountRef.current = 0;
    // When "Don't save settings" is on, all chats must stay ephemeral
    if (settings.noLocalStorage) {
      startEphemeral();
    } else {
      startNewChat();
    }
    titleGeneratedRef.current = null;
  }, [isStreaming, isEphemeral, activeThreadId, detachStream, messages, updateThread, stopStreaming, clearConversation, startNewChat, startEphemeral, settings.noLocalStorage]);

  const handleNewEphemeralChat = useCallback(() => {
    clearConversation();
    prevMessageCountRef.current = 0;
    startEphemeral();
    titleGeneratedRef.current = null;
  }, [clearConversation, startEphemeral]);

  // Force ephemeral mode whenever "Don't save settings" is enabled
  useEffect(() => {
    if (settings.noLocalStorage && !isEphemeral) {
      startEphemeral();
    }
  }, [settings.noLocalStorage, isEphemeral, startEphemeral]);

  // Auto-create and auto-save thread when messages change
  useEffect(() => {
    // No messages — don't touch prevMessageCountRef so the mount-restore value survives
    if (messages.length === 0) return;

    // Ephemeral / no-storage: keep ref in sync but skip saving
    if (isEphemeral || settings.noLocalStorage) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    // Create thread as soon as the first user message appears — before any response
    // arrives. This ensures handleNewChat / handleSwitchThread always have a thread
    // to detach an in-flight stream to, even if the user navigates away mid-stream.
    if (!activeThreadId) {
      createThread(messages, previousResponseId);
      prevMessageCountRef.current = messages.length;
      return; // title is deferred until the first assistant response arrives below
    }

    // Don't process further while actively streaming in the foreground view.
    if (isStreaming) return;

    const lastMessage = messages[messages.length - 1];
    const isNewAssistantReply =
      messages.length > prevMessageCountRef.current &&
      lastMessage.role === 'assistant' &&
      !lastMessage.isStreaming;

    if (isNewAssistantReply) {
      // Persist the completed response
      updateThread(activeThreadId, messages, previousResponseId);

      // Generate title once we have at least one user + assistant exchange
      if (titleGeneratedRef.current !== activeThreadId && isConfigured && messages.length >= 2) {
        const userMsg = messages[0];
        const assistantMsg = messages[1];
        if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
          const titleModel = settings.titleModelName || 'gpt-5-nano';
          const client = createAzureClient(settings);
          generateThreadTitle(client, titleModel, userMsg.content, assistantMsg.content)
            .then((title) => {
              updateThreadTitle(activeThreadId, title);
              titleGeneratedRef.current = activeThreadId;
            })
            .catch(() => {});
        }
      }
    } else if (messages.length !== prevMessageCountRef.current) {
      // Save message-count changes not covered above (e.g., after a retry)
      updateThread(activeThreadId, messages, previousResponseId);
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, isStreaming, isEphemeral, activeThreadId, previousResponseId, createThread, updateThread, updateThreadTitle, isConfigured, settings]);

  const inputPlaceholder = isConfigured
    ? undefined
    : 'Configure settings to start chatting...';

  // Calculate total token usage across all messages
  const conversationUsage = useMemo(
    () => calculateConversationUsage(messages),
    [messages]
  );

  // Derive the display title for the header
  const activeThread = activeThreadId ? threads.find((t) => t.id === activeThreadId) : null;
  const headerTitle = activeThread ? activeThread.title : 'Responses Chat';

  return (
    <div className="chat-container">
      <header className="chat-container__header">
        <div className="chat-container__title-area">
          <button
            className="chat-container__history-toggle"
            onClick={handleOpenHistory}
            aria-label="Open history"
            title="Chat history"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="chat-container__title">{headerTitle}</h1>
          {isEphemeral && (
            <button
              className="chat-container__ephemeral-badge"
              onClick={handleNewChat}
              title="Click to switch to a normal (persisted) chat"
            >
              Ephemeral ✕
            </button>
          )}
        </div>
        <SettingsButton onClick={handleOpenSettings} isConfigured={isConfigured} />
      </header>

      <MessageList
        messages={messages}
        isConfigured={isConfigured}
        onOpenJsonPanel={handleOpenJsonPanel}
        onMcpApprove={handleMcpApprove}
        onMcpDeny={handleMcpDeny}
        onRetry={handleRetry}
        isStreaming={isStreaming}
      />

      {!isConfigured && (
        <ConfigurationBanner onConfigureClick={handleOpenSettings} />
      )}

      <ChatInput
        onSendMessage={handleSendMessage}
        onClearConversation={handleNewChat}
        onStopStreaming={stopStreaming}
        isStreaming={isStreaming}
        disabled={!isConfigured || isStreaming}
        placeholder={inputPlaceholder}
        tokenUsage={conversationUsage}
        messages={messages}
        codeInterpreterEnabled={settings.codeInterpreterEnabled}
      />

      <HistorySidebar
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        threads={threads}
        activeThreadId={activeThreadId}
        isEphemeral={isEphemeral}
        onSwitchThread={handleSwitchThread}
        onDeleteThread={handleDeleteThread}
        onNewChat={handleNewChat}
        onNewEphemeralChat={handleNewEphemeralChat}
        hasMessages={messages.length > 0}
        backgroundStreamingThreadIds={backgroundStreamingThreadIds}
      />

      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClearStoredData={() => { clearStoredData(); clearAllThreads(); }}
        vectorStoreCache={vectorStoreCache}
        setVectorStores={setVectorStores}
        setStoreFiles={setStoreFiles}
        setStoreFilesLoading={setStoreFilesLoading}
      />

      <JsonSidePanel
        isOpen={jsonPanelData !== null}
        onClose={handleCloseJsonPanel}
        panelData={jsonPanelData}
      />
    </div>
  );
}
