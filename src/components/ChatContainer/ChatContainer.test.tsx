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
import type { Message, Settings, Thread } from '../../types';
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
  HistorySidebar: ({
    onNewChat,
    onNewEphemeralChat,
    onDeleteThread,
    onSwitchThread,
  }: {
    onNewChat: () => void;
    onNewEphemeralChat: () => void;
    onDeleteThread: (id: string) => void;
    onSwitchThread?: (id: string) => void;
  }) => (
    <>
      <button data-testid="history-new-chat-btn" onClick={onNewChat}>History New Chat</button>
      <button data-testid="history-ephemeral-btn" onClick={onNewEphemeralChat}>Ephemeral</button>
      <button data-testid="delete-thread-btn" onClick={() => onDeleteThread('thread-to-delete')}>Delete</button>
      {onSwitchThread && (
        <button data-testid="switch-thread-btn" onClick={() => onSwitchThread('thread-untitled')}>Switch</button>
      )}
    </>
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
    uploadedFileIds: [],
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
    expect(createThread).toHaveBeenCalledWith(messages, null, []);
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
    expect(detachStream).toHaveBeenCalledWith('thread-123', messages, [], expect.any(Function));
    expect(clearConversation).toHaveBeenCalled();
    expect(startNewChat).toHaveBeenCalled();
  });

  it('creates a thread and detaches stream when streaming with no thread (race window)', async () => {
    const createThread = vi.fn().mockReturnValue('thread-new');
    const detachStream = vi.fn();
    const clearConversation = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: true, detachStream, clearConversation })
    );
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: null, createThread }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(createThread).toHaveBeenCalledWith([expect.objectContaining({ role: 'user' })], null, []);
    expect(detachStream).toHaveBeenCalledWith('thread-new', [expect.objectContaining({ role: 'user' })], [], expect.any(Function));
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

  it('stops (does not detach) stream in ephemeral mode', async () => {
    const detachStream = vi.fn();
    const stopStreaming = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: true, detachStream, stopStreaming })
    );
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-123', isEphemeral: true }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).not.toHaveBeenCalled();
    expect(stopStreaming).toHaveBeenCalledTimes(1);
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
    const onComplete = detachStream.mock.calls[0][3] as (msgs: Message[], prevId: string | null, uploadedFileIds: string[]) => void;
    const finalMessages = [...messages, makeAssistantMessage('Final response', false)];
    act(() => { onComplete(finalMessages, 'resp-xyz', []); });

    expect(updateThread).toHaveBeenCalledWith('thread-abc', finalMessages, 'resp-xyz', []);
  });
});

describe('handleSwitchThread: background reattach fallback', () => {
  it('loads switched thread data when background flag exists but reattach returns null', async () => {
    const detachStream = vi.fn();
    const reattachStream = vi.fn().mockReturnValue(null);
    const loadThread = vi.fn();
    const messages = [makeUserMessage(), makeAssistantMessage('...', true)];
    const switchedMessages = [makeUserMessage('Saved'), makeAssistantMessage('Done', false)];
    const switchThreadFn = vi.fn().mockReturnValue({
      messages: switchedMessages,
      previousResponseId: 'resp-prev',
      uploadedFileIds: ['file_1'],
    });

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages, isStreaming: true, detachStream, reattachStream, loadThread })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: 'thread-untitled',
        threads: [{ id: 'thread-untitled', title: 'New Chat', createdAt: 1, updatedAt: 2, messages: switchedMessages, previousResponseId: 'resp-prev', uploadedFileIds: ['file_1'] }],
        switchThread: switchThreadFn,
      })
    );

    const { rerender } = render(<ChatContainer />);

    // Detach current stream and track thread as background-streaming
    await userEvent.click(screen.getByTestId('new-chat-btn'));
    expect(detachStream).toHaveBeenCalledWith('thread-untitled', messages, [], expect.any(Function));

    // Simulate transition to a non-streaming foreground after New Chat
    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [], isStreaming: false, detachStream, reattachStream, loadThread })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: null,
        threads: [{ id: 'thread-untitled', title: 'New Chat', createdAt: 1, updatedAt: 2, messages: switchedMessages, previousResponseId: 'resp-prev', uploadedFileIds: ['file_1'] }],
        switchThread: switchThreadFn,
      })
    );
    rerender(<ChatContainer />);

    // Reattach fails (race with completion) -> must still load switchThread data
    await userEvent.click(screen.getByTestId('switch-thread-btn'));
    expect(reattachStream).toHaveBeenCalledWith('thread-untitled');
    expect(loadThread).toHaveBeenCalledWith(switchedMessages, 'resp-prev', ['file_1']);
  });

  it('detaches the currently streaming thread before reattaching another background stream', async () => {
    const detachStream = vi.fn();
    const reattachStream = vi.fn().mockReturnValue([makeUserMessage('bg'), makeAssistantMessage('bg...', true)]);
    const loadThread = vi.fn();
    const backgroundMessages = [makeUserMessage('Old'), makeAssistantMessage('Old...', true)];
    const currentMessages = [makeUserMessage('Current'), makeAssistantMessage('Current...', true)];
    const switchThreadFn = vi.fn().mockReturnValue({
      messages: [makeUserMessage('Switched'), makeAssistantMessage('Done', false)],
      previousResponseId: 'resp-prev',
      uploadedFileIds: [],
    });

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: backgroundMessages, isStreaming: true, detachStream, reattachStream, loadThread })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: 'thread-untitled',
        threads: [{ id: 'thread-untitled', title: 'New Chat', createdAt: 1, updatedAt: 2, messages: backgroundMessages, previousResponseId: null, uploadedFileIds: [] }],
        switchThread: switchThreadFn,
      })
    );

    const { rerender } = render(<ChatContainer />);

    // Phase 1: detach thread-untitled to register it as background-streaming
    await userEvent.click(screen.getByTestId('new-chat-btn'));
    expect(detachStream).toHaveBeenCalledWith('thread-untitled', backgroundMessages, [], expect.any(Function));

    // Phase 2: now viewing another streaming thread, switch back to thread-untitled
    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: currentMessages, isStreaming: true, detachStream, reattachStream, loadThread, previousResponseId: 'resp-current' })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: 'thread-current',
        threads: [
          { id: 'thread-current', title: 'New Chat', createdAt: 1, updatedAt: 3, messages: currentMessages, previousResponseId: 'resp-current', uploadedFileIds: [] },
          { id: 'thread-untitled', title: 'New Chat', createdAt: 1, updatedAt: 2, messages: backgroundMessages, previousResponseId: null, uploadedFileIds: [] },
        ],
        switchThread: switchThreadFn,
      })
    );
    rerender(<ChatContainer />);

    await userEvent.click(screen.getByTestId('switch-thread-btn'));

    expect(reattachStream).toHaveBeenCalledWith('thread-untitled');
    expect(detachStream).toHaveBeenCalledWith('thread-current', currentMessages, [], expect.any(Function));
    expect(detachStream).toHaveBeenCalledTimes(2);
  });

  it('discard ephemeral stream when switching away, and start fresh on return', async () => {
    const detachStream = vi.fn();
    const reattachStream = vi.fn().mockReturnValue([makeUserMessage('ephemeral'), makeAssistantMessage('Still streaming', true)]);
    const loadThread = vi.fn();
    const clearConversation = vi.fn();
    const startEphemeral = vi.fn();
    const stopStreaming = vi.fn();
    const ephemeralMessages = [makeUserMessage('Ephemeral'), makeAssistantMessage('...', true)];
    const switchThreadFn = vi.fn().mockReturnValue({
      messages: [makeUserMessage('Saved'), makeAssistantMessage('Saved done', false)],
      previousResponseId: 'resp-saved',
      uploadedFileIds: [],
    });

    mockUseChat.mockReturnValue(
      makeChatReturn({
        messages: ephemeralMessages,
        isStreaming: true,
        stopStreaming,
        detachStream,
        reattachStream,
        loadThread,
        clearConversation,
      })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: null,
        isEphemeral: true,
        startEphemeral,
        threads: [{ id: 'thread-untitled', title: 'New Chat', createdAt: 1, updatedAt: 2, messages: [], previousResponseId: null, uploadedFileIds: [] }],
        switchThread: switchThreadFn,
      })
    );

    const { rerender } = render(<ChatContainer />);

    // Switch away while ephemeral is streaming -> should stop and discard ephemeral stream
    await userEvent.click(screen.getByTestId('switch-thread-btn'));
    expect(stopStreaming).toHaveBeenCalledTimes(1);
    expect(detachStream).not.toHaveBeenCalled();

    // Simulate now viewing a persisted thread (not ephemeral)
    mockUseChat.mockReturnValue(
      makeChatReturn({
        messages: [makeUserMessage('Saved'), makeAssistantMessage('Saved done', false)],
        isStreaming: false,
        detachStream,
        reattachStream,
        loadThread,
        clearConversation,
      })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: 'thread-untitled',
        isEphemeral: false,
        startEphemeral,
        threads: [{ id: 'thread-untitled', title: 'New Chat', createdAt: 1, updatedAt: 2, messages: [], previousResponseId: null, uploadedFileIds: [] }],
        switchThread: switchThreadFn,
      })
    );
    rerender(<ChatContainer />);

    await userEvent.click(screen.getByTestId('history-ephemeral-btn'));
    expect(reattachStream).not.toHaveBeenCalled();
    expect(clearConversation).toHaveBeenCalled();
    expect(startEphemeral).toHaveBeenCalledTimes(1);
  });

  it('switching from active ephemeral stream never detaches into persisted thread', async () => {
    const detachStream = vi.fn();
    const reattachStream = vi.fn();
    const loadThread = vi.fn();
    const stopStreaming = vi.fn();
    const switchThreadFn = vi.fn().mockReturnValue({
      messages: [makeUserMessage('Saved'), makeAssistantMessage('Saved done', false)],
      previousResponseId: 'resp-saved',
      uploadedFileIds: [],
    });

    // First render: persisted thread view, with ephemeral stream waiting in background
    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage('Saved')], isStreaming: false, detachStream, reattachStream, loadThread })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: 'thread-valid',
        isEphemeral: false,
        threads: [{ id: 'thread-valid', title: 'Saved Thread', createdAt: 1, updatedAt: 2, messages: [], previousResponseId: 'resp-valid', uploadedFileIds: [] }],
        switchThread: switchThreadFn,
      })
    );

    const { rerender } = render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('history-ephemeral-btn'));

    // Second render: user is now in ephemeral mode with active ephemeral stream
    mockUseChat.mockReturnValue(
      makeChatReturn({
        messages: [makeUserMessage('ephemeral'), makeAssistantMessage('Still streaming', true)],
        isStreaming: true,
        stopStreaming,
        detachStream,
        reattachStream,
        loadThread,
      })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: null,
        isEphemeral: true,
        threads: [{ id: 'thread-valid', title: 'Saved Thread', createdAt: 1, updatedAt: 2, messages: [], previousResponseId: 'resp-valid', uploadedFileIds: [] }],
        switchThread: switchThreadFn,
      })
    );
    rerender(<ChatContainer />);

    // Switch to a persisted thread while ephemeral stream is active:
    // it must stop streaming, not detach to any thread.
    await userEvent.click(screen.getByTestId('switch-thread-btn'));
    expect(stopStreaming).toHaveBeenCalled();
    expect(detachStream).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: title generation after first assistant response
// ---------------------------------------------------------------------------

describe('Title generation', () => {
  function setupTitleTest(settingsOverrides: Partial<Settings> = {}) {
    const userMsg = makeUserMessage('Tell me a joke');
    const assistantMsg = makeAssistantMessage('Why did the chicken cross the road?', false);
    const messages = [userMsg, assistantMsg];
    const updateThreadTitle = vi.fn();

    const settings = { ...defaultSettings, ...settingsOverrides } as Settings;
    mockUseSettingsContext.mockReturnValue({
      settings,
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
    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: false, previousResponseId: 'resp-1' }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-123', updateThreadTitle }));

    return { userMsg, assistantMsg, updateThreadTitle };
  }

  it('generates title after first assistant response arrives in an existing thread', async () => {
    const { userMsg, assistantMsg, updateThreadTitle } = setupTitleTest();

    render(<ChatContainer />);

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    expect(mockGenerateThreadTitle).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      userMsg.content,
      assistantMsg.content,
    );
    await waitFor(() => expect(updateThreadTitle).toHaveBeenCalledWith('thread-123', 'Generated Title'));
  });

  it('shows "Ephemeral Chat" title when ephemeral mode is active', async () => {
    mockUseChat.mockReturnValue(makeChatReturn({ messages: [], isStreaming: false }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: null, isEphemeral: true }));

    render(<ChatContainer />);
    expect(screen.getByRole('heading', { name: 'Ephemeral Chat' })).toBeInTheDocument();
  });

  it('does not generate title after first exchange (more than 2 messages)', async () => {
    const messages = [
      makeUserMessage('First'),
      makeAssistantMessage('First reply', false),
      makeUserMessage('Second'),
      makeAssistantMessage('Second reply', false),
    ];
    const updateThreadTitle = vi.fn();
    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: false }));
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({
        activeThreadId: 'thread-123',
        threads: [{ id: 'thread-123', title: 'New Chat', createdAt: 1, updatedAt: 2, messages, previousResponseId: 'resp-2', uploadedFileIds: [] }],
        updateThreadTitle,
      })
    );

    render(<ChatContainer />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGenerateThreadTitle).not.toHaveBeenCalled();
    expect(updateThreadTitle).not.toHaveBeenCalled();
  });

  it('falls back to the main model when the title model fails and models differ', async () => {
    const { updateThreadTitle } = setupTitleTest({
      titleModelName: 'gpt-5-nano' as Settings['titleModelName'],
      deploymentName: 'gpt-5',
    });

    // First call (title model) fails; second call (main model) succeeds
    mockGenerateThreadTitle
      .mockRejectedValueOnce(new Error('Model not found'))
      .mockResolvedValueOnce('Fallback Title');

    render(<ChatContainer />);

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(2));
    expect(mockGenerateThreadTitle.mock.calls[1][1]).toBe('gpt-5');
    await waitFor(() => expect(updateThreadTitle).toHaveBeenCalledWith('thread-123', 'Fallback Title'));
  });

  it('does not retry when title model and main model are the same', async () => {
    const { updateThreadTitle } = setupTitleTest({
      titleModelName: 'gpt-5-nano' as Settings['titleModelName'],
      deploymentName: 'gpt-5-nano',
    });

    mockGenerateThreadTitle.mockRejectedValue(new Error('Model not found'));

    render(<ChatContainer />);

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    // Only one attempt — same model, no point retrying
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1);
    expect(updateThreadTitle).not.toHaveBeenCalled();
  });

  it('keeps "New Chat" title when both title model and fallback model fail', async () => {
    const { updateThreadTitle } = setupTitleTest({
      titleModelName: 'gpt-5-nano' as Settings['titleModelName'],
      deploymentName: 'gpt-5',
    });

    mockGenerateThreadTitle.mockRejectedValue(new Error('Service unavailable'));

    render(<ChatContainer />);

    // Both calls fail — updateThreadTitle should never be called
    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 50));
    expect(updateThreadTitle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression tests: handleDeleteThread while streaming
// ---------------------------------------------------------------------------

describe('handleDeleteThread: streaming regression', () => {
  it('stops streaming when deleting the active thread while streaming', async () => {
    const stopStreaming = vi.fn();
    const clearConversation = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({
        messages: [makeUserMessage(), makeAssistantMessage('...', true)],
        isStreaming: true,
        stopStreaming,
        clearConversation,
      })
    );
    // active thread matches the thread being deleted
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-to-delete' }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('delete-thread-btn'));

    // stopStreaming must be called BEFORE clearConversation to prevent phantom thread creation
    expect(stopStreaming).toHaveBeenCalledTimes(1);
    expect(clearConversation).toHaveBeenCalledTimes(1);
    const stopOrder = stopStreaming.mock.invocationCallOrder[0];
    const clearOrder = clearConversation.mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(clearOrder);
  });

  it('does not call stopStreaming when deleting a non-active thread while streaming', async () => {
    const stopStreaming = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: true, stopStreaming })
    );
    // active thread is DIFFERENT from the one being deleted
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'other-thread' }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('delete-thread-btn'));

    expect(stopStreaming).not.toHaveBeenCalled();
  });

  it('does not call stopStreaming when deleting the active thread while NOT streaming', async () => {
    const stopStreaming = vi.fn();
    const clearConversation = vi.fn();

    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [makeUserMessage()], isStreaming: false, stopStreaming, clearConversation })
    );
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-to-delete' }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('delete-thread-btn'));

    expect(stopStreaming).not.toHaveBeenCalled();
    expect(clearConversation).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Regression: Bug 1 — first exchange must be saved after streaming completes
// ---------------------------------------------------------------------------

describe('Auto-save effect: first exchange saved after stream completes (Bug 1 regression)', () => {
  it('calls updateThread when the first assistant response finishes streaming in a new thread', async () => {
    // Render twice: first with streaming assistant (early thread creation), then completed
    const userMsg = makeUserMessage('Question');
    const assistantStreaming = makeAssistantMessage('Answer...', true);
    const assistantDone = makeAssistantMessage('Answer.', false);
    const updateThread = vi.fn();
    const createThread = vi.fn().mockReturnValue('thread-new');

    // Phase 1: streaming — thread just created, isStreaming=true
    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [userMsg, assistantStreaming], isStreaming: true })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({ activeThreadId: null, createThread, updateThread })
    );

    const { rerender } = render(<ChatContainer />);
    await waitFor(() => expect(createThread).toHaveBeenCalledTimes(1));

    // Phase 2: stream completes — same message count, isStreaming=false, last message no longer streaming
    mockUseChat.mockReturnValue(
      makeChatReturn({ messages: [userMsg, assistantDone], isStreaming: false })
    );
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({ activeThreadId: 'thread-new', createThread, updateThread })
    );
    rerender(<ChatContainer />);

    await waitFor(() => expect(updateThread).toHaveBeenCalled());
    expect(updateThread).toHaveBeenCalledWith('thread-new', [userMsg, assistantDone], null, []);
  });
});

// ---------------------------------------------------------------------------
// Regression: Bug 2 — handleNewChat must track detached stream in backgroundStreamingThreadIds
// ---------------------------------------------------------------------------

describe('handleNewChat: tracks detached stream in backgroundStreamingThreadIds (Bug 2 regression)', () => {
  it('adds the thread to backgroundStreamingThreadIds when detaching via New Chat', async () => {
    const messages = [makeUserMessage(), makeAssistantMessage('...', true)];
    const detachStream = vi.fn();
    const updateThread = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: true, detachStream }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({ activeThreadId: 'thread-abc', updateThread }));

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).toHaveBeenCalledWith('thread-abc', messages, [], expect.any(Function));

    // Fire the onComplete callback — updateThread must be called with the detached thread ID
    const onComplete = detachStream.mock.calls[0][3] as (msgs: Message[], prevId: string | null, uploadedFileIds: string[]) => void;
    const finalMessages = [...messages, makeAssistantMessage('Final', false)];
    act(() => { onComplete(finalMessages, 'resp-1', []); });
    expect(updateThread).toHaveBeenCalledWith('thread-abc', finalMessages, 'resp-1', []);
  });
});

// ---------------------------------------------------------------------------
// Regression: Bug 3 — titleGeneratedRef must NOT block untitled threads
// ---------------------------------------------------------------------------

describe('handleSwitchThread: does not block title generation for "New Chat" threads (Bug 3 regression)', () => {
  function makeThread(id: string, title: string, msgs: Message[]): Thread {
    return { id, title, messages: msgs, previousResponseId: null, uploadedFileIds: [], createdAt: Date.now(), updatedAt: Date.now() };
  }

  it('generates a title when switching away from an untitled ("New Chat") thread that has a completed conversation', async () => {
    const userMsg = makeUserMessage('Hello');
    const assistantMsg = makeAssistantMessage('Hi there', false);
    const threadMessages = [userMsg, assistantMsg];
    const updateThreadTitle = vi.fn();
    const switchThreadFn = vi.fn().mockReturnValue({ messages: threadMessages, previousResponseId: null, uploadedFileIds: [] });
    const loadThread = vi.fn();
    const untitledThread = makeThread('thread-untitled', 'New Chat', threadMessages);

    // Initial state: on a different thread with no messages
    mockUseChat.mockReturnValue(makeChatReturn({ messages: [], isStreaming: false, loadThread }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({
      activeThreadId: 'thread-other',
      threads: [untitledThread],
      switchThread: switchThreadFn,
      updateThreadTitle,
    }));

    const { rerender } = render(<ChatContainer />);

    // Switch to the "New Chat" titled thread (the mock button switches to 'thread-untitled')
    await userEvent.click(screen.getByTestId('switch-thread-btn'));

    // Simulate state after switch: active = thread-untitled, messages = completed conversation
    mockUseChat.mockReturnValue(makeChatReturn({ messages: threadMessages, isStreaming: false, loadThread }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({
      activeThreadId: 'thread-untitled',
      threads: [untitledThread],
      switchThread: switchThreadFn,
      updateThreadTitle,
    }));
    rerender(<ChatContainer />);

    // Navigate away — triggerTitleGeneration(activeThreadId='thread-untitled', messages) should
    // fire because titleGeneratedRef was NOT set for this thread (it has title "New Chat")
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    expect(mockGenerateThreadTitle).toHaveBeenCalledWith(
      expect.anything(), expect.any(String), userMsg.content, assistantMsg.content
    );
    await waitFor(() => expect(updateThreadTitle).toHaveBeenCalledWith('thread-untitled', 'Generated Title'));
  });

  it('does NOT generate a title when switching away from a thread that already has a real title', async () => {
    const userMsg = makeUserMessage('Hello');
    const assistantMsg = makeAssistantMessage('Hi there', false);
    const threadMessages = [userMsg, assistantMsg];
    const updateThreadTitle = vi.fn();
    const switchThreadFn = vi.fn().mockReturnValue({ messages: threadMessages, previousResponseId: null, uploadedFileIds: [] });
    const loadThread = vi.fn();
    const titledThread = makeThread('thread-untitled', 'My Real Title', threadMessages);

    // Initial state: on a different thread with no messages
    mockUseChat.mockReturnValue(makeChatReturn({ messages: [], isStreaming: false, loadThread }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({
      activeThreadId: 'thread-other',
      threads: [titledThread],
      switchThread: switchThreadFn,
      updateThreadTitle,
    }));

    const { rerender } = render(<ChatContainer />);

    // Switch to the real-titled thread — titleGeneratedRef SHOULD be set to its ID on switch-in
    await userEvent.click(screen.getByTestId('switch-thread-btn'));

    mockUseChat.mockReturnValue(makeChatReturn({ messages: threadMessages, isStreaming: false, loadThread }));
    mockUseThreads.mockReturnValue(makeThreadsReturn({
      activeThreadId: 'thread-untitled',
      threads: [titledThread],
      switchThread: switchThreadFn,
      updateThreadTitle,
    }));
    rerender(<ChatContainer />);

    // Navigate away — title was already marked as generated (via switch-in), so it should NOT fire
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    await new Promise((r) => setTimeout(r, 50));
    expect(mockGenerateThreadTitle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression: Bug 4 — title generation triggered on switch-away
// ---------------------------------------------------------------------------

describe('triggerTitleGeneration: called when switching away from completed conversation (Bug 4 regression)', () => {
  it('generates a title when switching away from a completed conversation (non-streaming)', async () => {
    const userMsg = makeUserMessage('Tell me a joke');
    const assistantMsg = makeAssistantMessage('Why did the chicken...', false);
    const messages = [userMsg, assistantMsg];
    const updateThreadTitle = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: false }));
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({ activeThreadId: 'thread-123', updateThreadTitle })
    );

    render(<ChatContainer />);
    // Clicking "New Chat" should trigger triggerTitleGeneration for the current thread
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    expect(mockGenerateThreadTitle).toHaveBeenCalledWith(
      expect.anything(), expect.any(String), userMsg.content, assistantMsg.content
    );
    await waitFor(() => expect(updateThreadTitle).toHaveBeenCalledWith('thread-123', 'Generated Title'));
  });

  it('generates a title via onComplete when switching away mid-stream', async () => {
    const messages = [makeUserMessage('Question'), makeAssistantMessage('...', true)];
    const detachStream = vi.fn();
    const updateThreadTitle = vi.fn();
    const updateThread = vi.fn();

    mockUseChat.mockReturnValue(makeChatReturn({ messages, isStreaming: true, detachStream }));
    mockUseThreads.mockReturnValue(
      makeThreadsReturn({ activeThreadId: 'thread-123', updateThread, updateThreadTitle })
    );

    render(<ChatContainer />);
    await userEvent.click(screen.getByTestId('new-chat-btn'));

    expect(detachStream).toHaveBeenCalledTimes(1);

    // Fire onComplete with a completed conversation
    const onComplete = detachStream.mock.calls[0][3] as (msgs: Message[], prevId: string | null, uploadedFileIds: string[]) => void;
    const finalMessages = [makeUserMessage('Question'), makeAssistantMessage('Full answer', false)];
    act(() => { onComplete(finalMessages, 'resp-1', []); });

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    expect(mockGenerateThreadTitle).toHaveBeenCalledWith(
      expect.anything(), expect.any(String), finalMessages[0].content, finalMessages[1].content
    );
  });
});
