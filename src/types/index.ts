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

/** Message render mode options */
export type MessageRenderMode = 'markdown' | 'plaintext' | 'code';

/** All message render mode options */
export const MESSAGE_RENDER_MODE_OPTIONS: MessageRenderMode[] = ['markdown', 'plaintext', 'code'];

/** MCP server approval requirement options */
export type McpApprovalMode = 'never';

/** Custom header for MCP server authentication */
export interface McpHeader {
  /** Header key (e.g., 'Authorization', 'X-API-Key') */
  key: string;
  /** Header value (e.g., 'Bearer token123') */
  value: string;
}

/** Configuration for a remote MCP server */
export interface McpServerConfig {
  /** Unique identifier */
  id: string;
  /** Display name for the server */
  name: string;
  /** Label used to identify the server in API requests */
  serverLabel: string;
  /** URL of the MCP server */
  serverUrl: string;
  /** When to require approval for MCP calls */
  requireApproval: McpApprovalMode;
  /** Custom headers for authentication */
  headers: McpHeader[];
  /** Whether this server is enabled */
  enabled: boolean;
}

/** Maximum number of MCP servers allowed */
export const MAX_MCP_SERVERS = 5;

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
  /** Enable web search tool for grounding responses with real-time web data */
  webSearchEnabled?: boolean;
  /** Enable code interpreter tool for executing Python code in a sandbox */
  codeInterpreterEnabled?: boolean;
  /** Message render mode for assistant messages */
  messageRenderMode: MessageRenderMode;
  /** Configured remote MCP servers */
  mcpServers?: McpServerConfig[];
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
  messageRenderMode: 'markdown',
  mcpServers: [],
};

/** Tool call status types */
export type ToolCallStatus =
  | 'in_progress'
  | 'searching'
  | 'interpreting'
  | 'completed'
  | 'aborted';

/** Tool call information */
export interface ToolCall {
  /** Unique identifier for the tool call */
  id: string;
  /** Name of the tool being called (e.g., 'web_search', function name, 'code_interpreter', 'mcp') */
  name: string;
  /** Type of tool call: 'function' for function calls, 'web_search' for web search, 'code_interpreter' for code execution, 'mcp' for MCP server calls */
  type: 'function' | 'web_search' | 'code_interpreter' | 'mcp';
  /** JSON arguments passed to the tool (for function calls) */
  arguments: string;
  /** Result from the tool execution, if any */
  result?: string;
  /** Status of the tool call */
  status?: ToolCallStatus;
  /** Search query (for web search calls) */
  query?: string;
  /** Python code being executed (for code interpreter calls) */
  code?: string;
  /** Execution output from code interpreter */
  output?: string;
  /** Container ID for code interpreter session */
  containerId?: string;
}

/** Reasoning step from the model */
export interface ReasoningStep {
  /** Unique identifier */
  id: string;
  /** Reasoning content */
  content: string;
}

/** URL citation from web search results */
export interface Citation {
  /** Citation URL */
  url: string;
  /** Citation title */
  title: string;
  /** Start index in the content where this citation applies */
  startIndex: number;
  /** End index in the content where this citation applies */
  endIndex: number;
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
  /** URL citations from web search */
  citations?: Citation[];
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  /** Whether this message represents an error */
  isError?: boolean;
  /** Whether this message was stopped by the user */
  isStopped?: boolean;
  /** Attachments included with the message */
  attachments?: Attachment[];
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

/** Attachment types supported */
export type AttachmentType = 'image' | 'file';

/** Supported image MIME types */
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Supported file MIME types */
export const SUPPORTED_FILE_TYPES = ['application/pdf'] as const;

/** All supported MIME types for attachments */
export const SUPPORTED_ATTACHMENT_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_FILE_TYPES] as const;

/** File attachment to be sent with a message */
export interface Attachment {
  /** Unique identifier */
  id: string;
  /** Original filename */
  name: string;
  /** Type of attachment: image or file */
  type: AttachmentType;
  /** MIME type of the file */
  mimeType: string;
  /** Base64-encoded file data (without data URL prefix) */
  base64: string;
  /** Preview URL for display (data URL for images) */
  previewUrl?: string;
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
