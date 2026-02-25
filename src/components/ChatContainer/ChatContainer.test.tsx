/**
 * Integration tests for ChatContainer streaming lifecycle and thread creation behaviour.
 *
 * Focus areas:
 * - Early thread creation: thread saved on first user message, before any response
 * - handleNewChat: detaches in-flight stream to background when thread exists
 * - handleNewChat: calls stopStreaming when no thread exists (race window)
 * - handleNewChat: no detach when not streaming
 * - Background detach completion calls updateThread with final messages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Message, Settings } from '../../types';
import { ChatContainer } from './ChatContainer';
import { useChat } from '../../hooks/useChat';
import { useThreads } from '../../hooks/useThreads';
import { useSettingsContext } from '../../context/SettingsContext';
import { generateThreadTitle } from '../../utils/titleGeneration';

// ---------------------------------------------------------------------------
// vi.mock — hoisted to top of file automatically by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../hooks/useChat');
vi.mock('../../hooks/useThreads');
vi.mock('../../context/SettingsContext');
vi.mock('../../utils/titleGeneration');
vi.mock('../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/api')>();
  return { ...actual, createAzureClient: vi.fn().mockReturnValue({}) };
});

// Stub out heavy child components
vi.mock('../MessageList', () => ({ MessageList: () => <div data-testid="message-list" /> }));
vi.mock('../ChatInput', () => ({
  ChatInput: ({ onClearConversation }: { onClearConversation: () => void }) => (
    <button data-testid="new-chat-btn" onClick={onClearConversation}>New Chat</button>
  ),
}));
vi.mock('../HistorySidebar', () => ({
  HistorySidebar: ({ onNewChat }: { onNewChat: () => void }) => (
    <button data-testid="history-new-chat-btn" onClick={onNewChat}>History New Chat</button>
  ),
}));
vi.mock('../SettingsSidebar', () => ({ SettingsSidebar: () => null }));
vi.mock('../SettingsButton', () => ({ SettingsButton: () => <button>Settings</button> }));
vi.mock('../JsonSidePanel', () => ({ JsonSidePanel: () => null }));
vi.mock('../ConfigurationBanner', () => ({ ConfigurationBanner: () => null }));

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockUseChat = vi.mocked(useChat);
const mockUseThreads = vi.mocked(useThreads);
const mockUseSettingsContext = vi.mocked(useSettingsContext);
const mockGenerateThreadTitle = vi.mocked(generateThreadTitle);

// ---------------------------------------------------------------------------
// Default factory values
// ---------------------------------------------------------------------------

const defaultSettings: Partial<Settings> = {
  apiKey: 'test-key',
  endpoint: 'https://test.openai.azure.com/',
  deploymentName: 'gpt-5-nano',
  noLocalStorage: false,
};

function makeChatReturn(overrides: Partial<ReturnType<typeof useChat>> = {}): ReturnType<typeof useChat> {
  return {
    messages: [],
    isStreaming: false,
    sendMessage: vi.fn(),
    stopStreaming: vi.fn(),
    clearConversation: vi.fn(),
    detachStream: vi.fn(),
    reattachStream: vi.fn(),
    loadThread: vi.fn(),
    retryMessage: vi.fn(),
    handleMcpApproval: vi.fn(),
    previousResponseId: null,
    error: null,
    ...overrides,
  };
}

function makeThreadsReturn(overrides: Partial<ReturnType<typeof useThreads>> = {}): ReturnType<typeof useThreads> {
  return {
    threads: [],
    activeThreadId: null,
    isLoading: false,
    isEphemeral: false,
    createThread: vi.fn().mockReturnValue('thread-new'),
    deleteThread: vi.fn(),
    switchThread: vi.fn(),
    updateThread: vi.fn(),
    updateThreadTitle: vi.fn(),
    startNewChat: vi.fn(),
    startEphemeral: vi.fn(),
    clearAllThreads: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeUserMessage(content = 'Hello'): Message {
  return { id: 'msg-user-1', role: 'user', content, timestamp: new Date() };
}

function makeAssistantMessage(content = 'Hi', streaming = false): Message {
  return { id: 'msg-asst-1', role: 'assistant', content, timestamp: new Date(), isStreaming: streaming };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockUseChat.mockReturnValue(makeChatReturn());
  mockUseThreads.mockReturnValue(makeThreadsReturn());
  mockUseSettingsContext.mockReturnValue({
    settings: defaultSettings as Settings,
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
    clearStoredData: vi.fn(),
    isConfigured: true,
    vectorStoreCache: {} as import('../../types').VectorStoreCache,
    setVectorStores: vi.fn(),
    setStoreFiles: vi.fn(),
    setStoreFilesLoading: vi.fn(),
    clearVectorStoreCache: vi.fn(),
  });
  mockGenerateThreadTitle.mockResolvedValue('Generated Title');
});

// ---------------------------------------------------------------------------
// Tests: early thread creation (auto-save effect)
// ---------------------------------------------------------------------------

describe('Auto-save effect: early thread creation', () => {
  it('calls createThread when first user message appears and no thread exists', async () => {
    const messages = [makeUserMessage()];
    const createThread = vi.fn().mockReturnValue('thread-new');

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: true }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: null, createThread }));

    render(<ChatContainer />);

    await waitFor(() => expect(createThread).toHaveBeenCalledTimes(1));
    expect(createThread).toHaveBeenCalledWith(messages, null);
  });

  it('does not generate a title when the thread is first created (only user message present)', async () => {
    const messages = [makeUserMessage()];
    const createThread = vi.fn().mockReturnValue('thread-new');

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: true }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: null, createThread }));

    render(<ChatContainer />);

    await waitFor(() => expect(createThread).toHaveBeenCalled());
    expect(mockGenerateThreadTitle).not.toHaveBeenCalled();
  });

  it('does not call createThread when already in an existing thread while streaming', async () => {
    const createThread = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages: [makeUserMessage()], isStreaming: true }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-existing', createThread }));

    render(<ChatContainer />);

    // isStreaming=true with an existing thread → blocked by the isStreaming guard
    await act(async () => {});
    expect(createThread).not.toHaveBeenCalled();
  });

  it('does not call createThread in ephemeral mode', async () => {
    const createThread = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages: [makeUserMessage()], isStreaming: true }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: null, isEphemeral: true, createThread }));

    render(<ChatContainer />);

    await act(async () => {});
    expect(createThread).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: handleNewChat streaming behaviour
// ---------------------------------------------------------------------------

describe('handleNewChat: streaming behaviour', () => {
  it('detaches stream when streaming in an existing thread', async () => {
    const messages = [makeUserMessage(), makeAssistantMessage('...', true)];
    const detachStream = vi.fn();
    const clearConversation = vi.fn();
    const startNewChat = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: true, detachStream, clearConversation }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-123', startNewChat }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).toHaveBeenCalledTimes(1);
    expect(detachStream).toHaveBeenCalledWith('thread-123', messages, expect.any(Function));
    expect(clearConversation).toHaveBeenCalled();
    expect(startNewChat).toHaveBeenCalled();
  });

  it('calls stopStreaming when streaming with no thread (race window)', async () => {
    const stopStreaming = vi.fn();
    const detachStream = vi.fn();
    const clearConversation = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: true, stopStreaming, detachStream, clearConversation })
    );
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: null }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(stopStreaming).toHaveBeenCalledTimes(1);
    expect(detachStream).not.toHaveBeenCalled();
    expect(clearConversation).toHaveBeenCalled();
  });

  it('does not call detachStream or stopStreaming when not streaming', async () => {
    const detachStream = vi.fn();
    const stopStreaming = vi.fn();
    const clearConversation = vi.fn();
    const startNewChat = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: false, detachStream, stopStreaming, clearConversation })
    );
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-123', startNewChat }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).not.toHaveBeenCalled();
    expect(stopStreaming).not.toHaveBeenCalled();
    expect(clearConversation).toHaveBeenCalled();
    expect(startNewChat).toHaveBeenCalled();
  });

  it('does not detach stream in ephemeral mode', async () => {
    const detachStream = vi.fn();
    const stopStreaming = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: true, detachStream, stopStreaming })
    );
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-123', isEphemeral: true }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).not.toHaveBeenCalled();
    expect(stopStreaming).not.toHaveBeenCalled();
  });

  it('calls updateThread via detach callback when background stream completes', async () => {
    const messages = [makeUserMessage(), makeAssistantMessage('...', true)];
    const detachStream = vi.fn();
    const updateThread = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: true, detachStream }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-abc', updateThread }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).toHaveBeenCalledTimes(1);

    // Capture the onComplete callback passed to detachStream and invoke it
    const onComplete = detachStream.mock.calls[0][2] as (msgs: Message[], prevId: string | null) => void;
    const finalMessages = [...messages, makeAssistantMessage('Final response', false)];
    act(() => { onComplete(finalMessages, 'resp-xyz'); });

    expect(updateThread).toHaveBeenCalledWith('thread-abc', finalMessages, 'resp-xyz');
  });
});

// ---------------------------------------------------------------------------
// Tests: title generation after first assistant response
// ---------------------------------------------------------------------------

describe('Title generation', () => {
  it('generates title after first assistant response arrives in an existing thread', async () => {
    const userMsg = makeUserMessage('Tell me a joke');
    const assistantMsg = makeAssistantMessage('Why did the chicken cross the road?', false);
    const messages = [userMsg, assistantMsg];
    const updateThreadTitle = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: false, previousResponseId: 'resp-1' }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-123', updateThreadTitle }));

    render(<ChatContainer />);

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    expect(mockGenerateThreadTitle).toHaveBeenCalledWith(
      expect.anything(),   // client
      expect.any(String),  // model
      userMsg.content,
      assistantMsg.content,
    );

    await waitFor(() => expect(updateThreadTitle).toHaveBeenCalledWith('thread-123', 'Generated Title'));
  });
});
