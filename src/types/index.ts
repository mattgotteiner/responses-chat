/**
 * Shared types for Azure OpenAI Responses Chat
 */

/** Supported model names */
export type ModelName =
  | 'gpt-5-nano'
  | 'gpt-5-mini'
  | 'gpt-5'
  | 'gpt-5.1'
  | 'gpt-5.2';

/** Reasoning effort levels */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

/** Verbosity levels */
export type Verbosity = 'low' | 'medium' | 'high';

/** Model configuration for reasoning effort options */
export const MODEL_REASONING_EFFORTS: Record<ModelName, ReasoningEffort[]> = {
  'gpt-5-nano': ['low', 'medium', 'high'],
  'gpt-5-mini': ['low', 'medium', 'high'],
  'gpt-5': ['low', 'medium', 'high', 'minimal'],
  'gpt-5.1': ['low', 'medium', 'high', 'minimal', 'none'],
  'gpt-5.2': ['low', 'medium', 'high', 'minimal', 'none'],
};

/** All available models */
export const AVAILABLE_MODELS: ModelName[] = [
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-5',
  'gpt-5.1',
  'gpt-5.2',
];

/** All verbosity options */
export const VERBOSITY_OPTIONS: Verbosity[] = ['low', 'medium', 'high'];

/** Reasoning summary type */
export type ReasoningSummary = 'auto' | 'concise' | 'detailed';

/** All reasoning summary options */
export const REASONING_SUMMARY_OPTIONS: ReasoningSummary[] = ['auto', 'concise', 'detailed'];

/** Application settings stored in localStorage */
export interface Settings {
  /** Azure OpenAI endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey: string;
  /** Selected model name */
  modelName: ModelName;
  /** Deployment name (defaults to modelName if empty) */
  deploymentName: string;
  /** Optional reasoning effort level */
  reasoningEffort?: ReasoningEffort;
  /** Optional reasoning summary type */
  reasoningSummary?: ReasoningSummary;
  /** Optional verbosity level */
  verbosity?: Verbosity;
  /** Optional developer/system instructions */
  developerInstructions?: string;
}

/** Default settings values */
export const DEFAULT_SETTINGS: Settings = {
  endpoint: '',
  apiKey: '',
  modelName: 'gpt-5-mini',
  deploymentName: '',
  reasoningEffort: undefined,
  reasoningSummary: 'detailed',
  verbosity: undefined,
  developerInstructions: undefined,
};

/** Tool call information */
export interface ToolCall {
  /** Unique identifier for the tool call */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** JSON arguments passed to the tool */
  arguments: string;
  /** Result from the tool execution, if any */
  result?: string;
}

/** Reasoning step from the model */
export interface ReasoningStep {
  /** Unique identifier */
  id: string;
  /** Reasoning content */
  content: string;
}

/** A message in the conversation */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Role of the message sender */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Reasoning steps from the model */
  reasoning?: ReasoningStep[];
  /** Tool calls made by the assistant */
  toolCalls?: ToolCall[];
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  /** Whether this message represents an error */
  isError?: boolean;
  /** Whether this message was stopped by the user */
  isStopped?: boolean;
  /** Timestamp of the message */
  timestamp: Date;
  /** Raw API request JSON (for user messages) */
  requestJson?: Record<string, unknown>;
  /** Raw API response JSON (for assistant messages) */
  responseJson?: Record<string, unknown>;
}

/** Chat state */
export interface ChatState {
  /** All messages in the conversation */
  messages: Message[];
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Previous response ID for conversation continuity */
  previousResponseId: string | null;
}
