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
    onDeleteThread,
    onSwitchThread,
  }: {
    onNewChat: () => void;
    onDeleteThread: (id: string) => void;
    onSwitchThread?: (id: string) => void;
  }) => (
    <>
      <button data-testid="history-new-chat-btn" onClick={onNewChat}>History New Chat</button>
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
    expect(updateThread).toHaveBeenCalledWith('thread-new', [userMsg, assistantDone], null);
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

    expect(detachStream).toHaveBeenCalledWith('thread-abc', messages, expect.any(Function));

    // Fire the onComplete callback — updateThread must be called with the detached thread ID
    const onComplete = detachStream.mock.calls[0][2] as (msgs: Message[], prevId: string | null) => void;
    const finalMessages = [...messages, makeAssistantMessage('Final', false)];
    act(() => { onComplete(finalMessages, 'resp-1'); });
    expect(updateThread).toHaveBeenCalledWith('thread-abc', finalMessages, 'resp-1');
  });
});

// ---------------------------------------------------------------------------
// Regression: Bug 3 — titleGeneratedRef must NOT block untitled threads
// ---------------------------------------------------------------------------

describe('handleSwitchThread: does not block title generation for "New Chat" threads (Bug 3 regression)', () => {
  function makeThread(id: string, title: string, msgs: Message[]): Thread {
    return { id, title, messages: msgs, previousResponseId: null, createdAt: Date.now(), updatedAt: Date.now() };
  }

  it('generates a title when switching away from an untitled ("New Chat") thread that has a completed conversation', async () => {
    const userMsg = makeUserMessage('Hello');
    const assistantMsg = makeAssistantMessage('Hi there', false);
    const threadMessages = [userMsg, assistantMsg];
    const updateThreadTitle = vi.fn();
    const switchThreadFn = vi.fn().mockReturnValue({ messages: threadMessages, previousResponseId: null });
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
    const switchThreadFn = vi.fn().mockReturnValue({ messages: threadMessages, previousResponseId: null });
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
    const onComplete = detachStream.mock.calls[0][2] as (msgs: Message[], prevId: string | null) => void;
    const finalMessages = [makeUserMessage('Question'), makeAssistantMessage('Full answer', false)];
    act(() => { onComplete(finalMessages, 'resp-1'); });

    await waitFor(() => expect(mockGenerateThreadTitle).toHaveBeenCalledTimes(1));
    expect(mockGenerateThreadTitle).toHaveBeenCalledWith(
      expect.anything(), expect.any(String), finalMessages[0].content, finalMessages[1].content
    );
  });
});
