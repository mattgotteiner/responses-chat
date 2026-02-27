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
import type { Attachment, Message } from '../../types';
import './ChatContainer.css';

/**
 * Main chat container with header, message list, and input
 */
export function ChatContainer() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [jsonPanelData, setJsonPanelData] = useState<JsonPanelData | null>(null);
  const { settings, updateSettings, clearStoredData, isConfigured, vectorStoreCache, setVectorStores, setStoreFiles, setStoreFilesLoading } = useSettingsContext();
  const { messages, isStreaming, sendMessage, stopStreaming, clearConversation, handleMcpApproval, retryMessage, loadThread, detachStream, reattachStream, abortBackgroundStream, previousResponseId, uploadedFileIds } = useChat();
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
  // Track which thread IDs are currently having a title generated
  const [generatingTitleThreadIds, setGeneratingTitleThreadIds] = useState<Set<string>>(new Set());
  // Guard: ensure the restore-on-load logic runs at most once
  const hasRestoredRef = useRef(false);
  // Keep latest threads available inside async callbacks (e.g., title generation)
  const threadsRef = useRef(threads);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Restore the active thread once IndexedDB has finished loading
  useEffect(() => {
    if (threadsLoading || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
        if (activeThreadId) {
          const thread = threads.find((t) => t.id === activeThreadId);
          if (thread) {
          loadThread(thread.messages, thread.previousResponseId, thread.uploadedFileIds);
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

  /**
   * Generate a title for the given thread if it hasn't been titled yet.
   * Safe to call from any switch-away or stream-completion path; deduplicates
   * via titleGeneratedRef. Falls back to the main deployment model on error.
   */
  const triggerTitleGeneration = useCallback(
    (threadId: string, msgs: Message[]) => {
      if (titleGeneratedRef.current === threadId || !isConfigured || msgs.length !== 2) return;
      const currentThread = threadsRef.current.find((t) => t.id === threadId);
      if (currentThread && currentThread.title !== 'New Chat') return;
      const userMsg = msgs[0];
      const assistantMsg = msgs[1];
      if (userMsg.role !== 'user' || assistantMsg.role !== 'assistant') return;
      titleGeneratedRef.current = threadId; // optimistic guard — prevents duplicate calls
      const titleModel = settings.titleModelName || 'gpt-5-nano';
      const mainModel = settings.deploymentName;
      const client = createAzureClient(settings);
      setGeneratingTitleThreadIds((prev) => new Set([...prev, threadId]));
      generateThreadTitle(client, titleModel, userMsg.content, assistantMsg.content)
        .catch(() => {
          if (mainModel && mainModel !== titleModel) {
            return generateThreadTitle(client, mainModel, userMsg.content, assistantMsg.content);
          }
          return undefined;
        })
        .then((title) => {
          const latestThread = threadsRef.current.find((t) => t.id === threadId);
          if (title && (!latestThread || latestThread.title === 'New Chat')) {
            updateThreadTitle(threadId, title);
          }
        })
        .catch(() => {})
        .finally(() => {
          setGeneratingTitleThreadIds((prev) => {
            const next = new Set(prev);
            next.delete(threadId);
            return next;
          });
        });
    },
    [isConfigured, settings, updateThreadTitle]
  );

  const handleSwitchThread = useCallback(
    (id: string) => {
      if (isStreaming && isEphemeral) {
        stopStreaming();
        clearConversation();
        prevMessageCountRef.current = 0;
      }

      // Re-attach if the user is switching back to a background-streaming thread
      if (backgroundStreamingThreadIds.has(id)) {
        // If the currently viewed thread is also streaming, detach it first so its
        // stream keeps running in the background while we re-attach the target thread.
        if (isStreaming && !isEphemeral) {
          let currentThreadId = activeThreadId;
          if (!currentThreadId) {
            currentThreadId = createThread(messages, previousResponseId, uploadedFileIds);
          }
          if (currentThreadId !== id) {
            const threadIdForCallback = currentThreadId;
            detachStream(threadIdForCallback, messages, uploadedFileIds, (finalMessages, finalPrevResponseId, finalUploadedFileIds) => {
              updateThread(threadIdForCallback, finalMessages, finalPrevResponseId, finalUploadedFileIds);
              triggerTitleGeneration(threadIdForCallback, finalMessages);
              setBackgroundStreamingThreadIds((prev) => {
                const next = new Set(prev);
                next.delete(threadIdForCallback);
                return next;
              });
            });
            setBackgroundStreamingThreadIds((prev) => new Set([...prev, threadIdForCallback]));
          }
        }

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
        const data = switchThread(id);
        if (!buffer && data) {
          loadThread(data.messages, data.previousResponseId, data.uploadedFileIds);
          prevMessageCountRef.current = data.messages.length;
        }
        // Only mark as "titled" if the thread already has a real title — otherwise
        // triggerTitleGeneration (called from onComplete) must be allowed to run.
        const reattachedThread = threads.find((t) => t.id === id);
        if (reattachedThread && reattachedThread.title !== 'New Chat') {
          titleGeneratedRef.current = id;
        }
        return;
      }

      // Detach an in-flight foreground stream so it keeps running in the background
      if (isStreaming && !isEphemeral) {
        let targetThreadId = activeThreadId;
        if (!targetThreadId) {
          targetThreadId = createThread(messages, previousResponseId, uploadedFileIds);
        }
        const threadIdForCallback = targetThreadId;
        const currentMessages = messages;
        detachStream(threadIdForCallback, currentMessages, uploadedFileIds, (finalMessages, finalPrevResponseId, finalUploadedFileIds) => {
          updateThread(threadIdForCallback, finalMessages, finalPrevResponseId, finalUploadedFileIds);
          triggerTitleGeneration(threadIdForCallback, finalMessages);
          setBackgroundStreamingThreadIds((prev) => {
            const next = new Set(prev);
            next.delete(threadIdForCallback);
            return next;
          });
        });
        setBackgroundStreamingThreadIds((prev) => new Set([...prev, threadIdForCallback]));
      } else if (activeThreadId) {
        // Not streaming — generate title for current thread before switching away
        triggerTitleGeneration(activeThreadId, messages);
      }

      const data = switchThread(id);
      if (data) {
        loadThread(data.messages, data.previousResponseId, data.uploadedFileIds);
        // Reset count to the new thread's size so the auto-save effect doesn't
        // misfire against this thread when the background stream eventually sets
        // isStreaming=false and causes a re-run with a stale prevMessageCountRef.
        prevMessageCountRef.current = data.messages.length;
        // Only mark as "titled" if the thread already has a real title.
        const targetThread = threads.find((t) => t.id === id);
        if (targetThread && targetThread.title !== 'New Chat') {
          titleGeneratedRef.current = id;
        }
      }
    },
    [switchThread, loadThread, detachStream, reattachStream, isStreaming, isEphemeral, activeThreadId, updateThread, createThread, messages, previousResponseId, uploadedFileIds, backgroundStreamingThreadIds, threads, triggerTitleGeneration, stopStreaming, clearConversation]
  );

  const handleDeleteThread = useCallback(
    (id: string) => {
      if (backgroundStreamingThreadIds.has(id)) {
        abortBackgroundStream(id);
        setBackgroundStreamingThreadIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
      if (id === activeThreadId) {
        // Stop any in-flight stream first — otherwise it would keep writing to
        // messages after clearConversation(), and the auto-save effect would create
        // a phantom thread (activeThreadId=null + messages>0).
        if (isStreaming) stopStreaming();
        clearConversation();
        prevMessageCountRef.current = 0;
      }
      deleteThread(id);
    },
    [backgroundStreamingThreadIds, abortBackgroundStream, deleteThread, activeThreadId, clearConversation, isStreaming, stopStreaming]
  );

  const handleNewChat = useCallback(() => {
    // If a stream is running, detach it to background so the response is saved when complete.
    // Track in backgroundStreamingThreadIds so the user can reattach if they navigate back.
    if (isStreaming && !isEphemeral) {
      const threadIdForCallback = activeThreadId ?? createThread(messages, previousResponseId, uploadedFileIds);
      detachStream(threadIdForCallback, messages, uploadedFileIds, (finalMessages, finalPrevResponseId, finalUploadedFileIds) => {
        updateThread(threadIdForCallback, finalMessages, finalPrevResponseId, finalUploadedFileIds);
        triggerTitleGeneration(threadIdForCallback, finalMessages);
        setBackgroundStreamingThreadIds((prev) => {
          const next = new Set(prev);
          next.delete(threadIdForCallback);
          return next;
        });
      });
      setBackgroundStreamingThreadIds((prev) => new Set([...prev, threadIdForCallback]));
    } else if (isStreaming && isEphemeral) {
      stopStreaming();
    } else if (activeThreadId) {
      // Not streaming — generate title now before clearing (auto-save effect may be skipped)
      triggerTitleGeneration(activeThreadId, messages);
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
  }, [isStreaming, isEphemeral, activeThreadId, detachStream, messages, uploadedFileIds, previousResponseId, createThread, updateThread, triggerTitleGeneration, clearConversation, stopStreaming, startNewChat, startEphemeral, settings.noLocalStorage]);

  const handleNewEphemeralChat = useCallback(() => {
    if (isStreaming && isEphemeral) {
      // Ephemeral streams are always discarded on navigation
      stopStreaming();
    } else if (isStreaming && !isEphemeral) {
      // Non-ephemeral stream: detach to background so the current thread is saved
      const threadIdForCallback = activeThreadId ?? createThread(messages, previousResponseId, uploadedFileIds);
      detachStream(threadIdForCallback, messages, uploadedFileIds, (finalMessages, finalPrevResponseId, finalUploadedFileIds) => {
        updateThread(threadIdForCallback, finalMessages, finalPrevResponseId, finalUploadedFileIds);
        triggerTitleGeneration(threadIdForCallback, finalMessages);
        setBackgroundStreamingThreadIds((prev) => {
          const next = new Set(prev);
          next.delete(threadIdForCallback);
          return next;
        });
      });
      setBackgroundStreamingThreadIds((prev) => new Set([...prev, threadIdForCallback]));
    }
    clearConversation();
    prevMessageCountRef.current = 0;
    startEphemeral();
    titleGeneratedRef.current = null;
  }, [clearConversation, startEphemeral, isStreaming, isEphemeral, stopStreaming, activeThreadId, createThread, messages, previousResponseId, uploadedFileIds, detachStream, updateThread, triggerTitleGeneration]);

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
      createThread(messages, previousResponseId, uploadedFileIds);
      // Set one below length so that streaming completion (same count, isStreaming→false)
      // still satisfies isNewAssistantReply = (length > length-1) = TRUE and triggers
      // updateThread with the finalised (non-streaming) assistant message.
      prevMessageCountRef.current = messages.length - 1;
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
      updateThread(activeThreadId, messages, previousResponseId, uploadedFileIds);
      triggerTitleGeneration(activeThreadId, messages);
    } else if (messages.length !== prevMessageCountRef.current) {
      // Save message-count changes not covered above (e.g., after a retry)
      updateThread(activeThreadId, messages, previousResponseId, uploadedFileIds);
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, isStreaming, isEphemeral, activeThreadId, previousResponseId, uploadedFileIds, createThread, updateThread, triggerTitleGeneration, settings.noLocalStorage]);

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
  const headerTitle = isEphemeral ? 'Ephemeral Chat' : activeThread ? activeThread.title : 'Responses Chat';

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
              className="chat-container__ephemeral-close"
              onClick={handleNewChat}
              title="Ephemeral chat — click to switch to a normal chat"
              aria-label="Exit ephemeral chat"
            >
              ✕
            </button>
          )}
        </div>
        <SettingsButton onClick={handleOpenSettings} isConfigured={isConfigured} />
      </header>

      <MessageList
        key={activeThreadId ?? 'ephemeral'}
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
        generatingTitleThreadIds={generatingTitleThreadIds}
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
