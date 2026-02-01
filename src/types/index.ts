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

/** Token usage details for input tokens */
export interface InputTokensDetails {
  /** Number of cached tokens used */
  cached_tokens: number;
}

/** Token usage details for output tokens */
export interface OutputTokensDetails {
  /** Number of reasoning tokens used */
  reasoning_tokens: number;
}

/** Token usage statistics from API response */
export interface TokenUsage {
  /** Number of input tokens consumed */
  input_tokens: number;
  /** Detailed breakdown of input tokens */
  input_tokens_details?: InputTokensDetails;
  /** Number of output tokens generated */
  output_tokens: number;
  /** Detailed breakdown of output tokens */
  output_tokens_details?: OutputTokensDetails;
  /** Total tokens (input + output) */
  total_tokens: number;
}

/**
 * Extracts typed TokenUsage from a response JSON object
 * @param responseJson - The raw response JSON from the API
 * @returns TokenUsage object if valid, undefined otherwise
 */
/**
 * Validates and extracts InputTokensDetails from raw API data
 */
function extractInputTokensDetails(
  details: unknown
): InputTokensDetails | undefined {
  if (!details || typeof details !== 'object') {
    return undefined;
  }
  const d = details as Record<string, unknown>;
  if (typeof d['cached_tokens'] !== 'number') {
    return undefined;
  }
  return { cached_tokens: d['cached_tokens'] };
}

/**
 * Validates and extracts OutputTokensDetails from raw API data
 */
function extractOutputTokensDetails(
  details: unknown
): OutputTokensDetails | undefined {
  if (!details || typeof details !== 'object') {
    return undefined;
  }
  const d = details as Record<string, unknown>;
  if (typeof d['reasoning_tokens'] !== 'number') {
    return undefined;
  }
  return { reasoning_tokens: d['reasoning_tokens'] };
}

export function extractTokenUsage(
  responseJson: Record<string, unknown> | undefined
): TokenUsage | undefined {
  if (!responseJson || typeof responseJson !== 'object') {
    return undefined;
  }

  if (!('usage' in responseJson)) {
    return undefined;
  }

  const usage = responseJson['usage'];
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const u = usage as Record<string, unknown>;
  if (
    typeof u['input_tokens'] !== 'number' ||
    typeof u['output_tokens'] !== 'number' ||
    typeof u['total_tokens'] !== 'number'
  ) {
    return undefined;
  }

  return {
    input_tokens: u['input_tokens'],
    output_tokens: u['output_tokens'],
    total_tokens: u['total_tokens'],
    input_tokens_details: extractInputTokensDetails(u['input_tokens_details']),
    output_tokens_details: extractOutputTokensDetails(u['output_tokens_details']),
  };
}
