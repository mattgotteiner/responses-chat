# MCP Approval Feature Backlog

This document captures the design and implementation plan for MCP tool call approval functionality. The feature was partially implemented but backed out to reduce scope. This backlog preserves all knowledge for future implementation.

## Overview

MCP (Model Context Protocol) servers can be configured to require user approval before executing tool calls. This provides a safety mechanism where the user reviews the tool name, arguments, and server before allowing execution.

## API Integration

### Request Configuration

When configuring an MCP server tool in the request, the `require_approval` field controls approval behavior:

```json
{
  "tools": [
    {
      "type": "mcp",
      "server_label": "mslearn",
      "server_url": "https://learn.microsoft.com/api/mcp",
      "require_approval": "always"
    }
  ]
}
```

**`require_approval` values:**
- `"never"` - Tool calls execute automatically without user approval (current behavior)
- `"always"` - Every tool call requires explicit user approval before execution

### Approval Request Events

When `require_approval: "always"`, the API sends an `mcp_approval_request` output item in the streaming response:

```json
{
  "type": "response.output_item.added",
  "item": {
    "id": "mcpr_abc123",
    "type": "mcp_approval_request",
    "name": "microsoft_docs_search",
    "server_label": "mslearn",
    "arguments": "{\"query\": \"Azure AI Foundry\"}"
  }
}
```

The response completes in a "waiting for approval" state. The `mcp_approval_request` contains:
- `id`: Unique identifier for the approval request (used in the response)
- `name`: Name of the tool being called
- `server_label`: Which MCP server is being called
- `arguments`: JSON-encoded arguments that will be passed to the tool

### Sending Approval Response

To continue the conversation after an approval request, send an `mcp_approval_response` input:

**Approval:**
```json
{
  "model": "gpt-5",
  "input": [
    {
      "type": "mcp_approval_response",
      "approval_request_id": "mcpr_abc123",
      "approve": true
    }
  ],
  "previous_response_id": "resp_xyz789",
  "tools": [/* same tools configuration */]
}
```

**Denial:**
```json
{
  "model": "gpt-5",
  "input": [
    {
      "type": "mcp_approval_response",
      "approval_request_id": "mcpr_abc123",
      "approve": false
    }
  ],
  "previous_response_id": "resp_xyz789"
}
```

**Important:** The `previous_response_id` must reference the response that contained the approval request. This maintains conversation continuity.

### After Approval/Denial

**Approval (`approve: true`):**
- The API executes the tool call
- Streaming continues with tool results and model's response
- Handle subsequent MCP events (`mcp_call.in_progress`, `mcp_call.completed`)

**Denial (`approve: false`):**
- The tool call is not executed
- The model receives context that the tool was denied
- Model may respond or request alternative tools
- Consider resetting `previous_response_id` to start fresh

## UI/UX Design

### Approval Card Display

When an approval request is received, display a prominent approval card:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠️  mslearn/microsoft_docs_search    [Approval Required] │
├──────────────────────────────────────────────────────────┤
│ Arguments                                                 │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ {                                                    │ │
│ │   "query": "Azure AI Foundry"                        │ │
│ │ }                                                    │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│              [ ✓ Approve ]    [ ✕ Deny ]                 │
└──────────────────────────────────────────────────────────┘
```

### States

1. **Pending Approval** (`pending_approval`)
   - Yellow/amber styling
   - Pulsing animation to draw attention
   - Approve/Deny buttons enabled
   - Expandable to show full arguments

2. **Approved** (`approved`)
   - Green checkmark or success indicator
   - "Tool call approved" message
   - Buttons hidden
   - Streaming continues into same message

3. **Denied** (`denied`)
   - Red/muted styling
   - "Tool call denied by user" message
   - Buttons hidden
   - Conversation may continue with model acknowledging denial

### Recording Handling

For approval flows, recording needs special handling:
- Don't finalize recording when approval is pending
- Continue recording when user responds
- Finalize after the complete flow completes

## Implementation Tasks

### Types (`src/types/index.ts`)

1. Add `'always'` back to `McpApprovalMode`:
   ```typescript
   export type McpApprovalMode = 'never' | 'always';
   export const MCP_APPROVAL_OPTIONS: McpApprovalMode[] = ['never', 'always'];
   ```

2. Add approval-related tool call statuses:
   ```typescript
   export type ToolCallStatus =
     | 'in_progress'
     | 'searching'
     | 'interpreting'
     | 'completed'
     | 'aborted'
     | 'pending_approval'  // Add
     | 'approved'          // Add
     | 'denied';           // Add
   ```

3. Add `'mcp_approval'` tool call type:
   ```typescript
   type: 'function' | 'web_search' | 'code_interpreter' | 'mcp' | 'mcp_approval';
   ```

4. Add `serverLabel` field to `ToolCall` interface:
   ```typescript
   serverLabel?: string;
   ```

### Stream Processor (`src/utils/streamProcessor.ts`)

Add handler for `mcp_approval_request` events in `processStreamEvent`:

```typescript
if (itemEvent.item?.type === 'mcp_approval_request') {
  const approvalItem = itemEvent.item as {
    id?: string;
    name?: string;
    server_label?: string;
    arguments?: string;
  };
  // Create tool call with type 'mcp_approval' and status 'pending_approval'
  // ...
}
```

### useChat Hook (`src/hooks/useChat.ts`)

1. Add `handleMcpApproval` function:
   - Find message with matching approval request
   - Update tool call status to approved/denied
   - If approved: send approval response and continue streaming
   - If denied: send denial and optionally reset conversation chain

2. Track pending approvals to delay recording finalization

3. Return `handleMcpApproval` from hook

### ToolCallBox Component (`src/components/ToolCallBox/`)

1. Add props for approval handlers:
   ```typescript
   interface ToolCallBoxProps {
     toolCall: ToolCall;
     onApprove?: (approvalId: string) => void;
     onDeny?: (approvalId: string) => void;
   }
   ```

2. Create `McpApprovalContent` component with:
   - Expandable/collapsible arguments view
   - Approve/Deny buttons (when pending)
   - Status display (approved/denied)
   - Appropriate styling for each state

3. Add CSS for approval states (pulsing animation, status colors)

### McpServerSettings Component (`src/components/McpServerSettings/`)

Re-enable the approval mode dropdown:
- "Never (skip approvals)" - `'never'`
- "Always (require approval)" - `'always'`

### Message Components

Thread approval handlers through:
- `ChatContainer` → `MessageList` → `Message` → `ToolCallBox`

### Tests

Add/restore tests for:
- Stream processor handling of approval events
- ToolCallBox approval UI and interactions
- useChat approval flow

### Recordings

Restore `recordings/single-turn-mcp-approval.jsonl` for e2e testing of approval flow.

## CSS Styling Notes

```css
/* Pending approval state */
.tool-call-box--pending-approval {
  border-color: #d4a574;
  background-color: #2d2a1f;
}

.tool-call-box__status--pending_approval {
  background-color: #fff3cd;
  color: #856404;
  animation: pulse-approval 2s ease-in-out infinite;
}

@keyframes pulse-approval {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Approval action buttons */
.tool-call-box__approval-actions {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-top: 1px solid #3d3520;
}

.tool-call-box__approve-btn {
  background-color: #2d5a2d;
  color: #90ee90;
}

.tool-call-box__deny-btn {
  background-color: #5a2d2d;
  color: #ffa0a0;
}
```

## Edge Cases to Handle

1. **Multiple pending approvals**: User may need to approve multiple tool calls
2. **Approval timeout**: Consider if approvals should expire
3. **Abort during approval**: Handle if user stops streaming while approval is pending
4. **Error after approval**: Handle API errors gracefully, allow retry
5. **Recording continuity**: Ensure recordings capture the full approve/deny flow
6. **Conversation chain**: Properly maintain `previous_response_id` through approval flow

## Testing Strategy

1. **Unit tests**: Stream processor, approval UI components
2. **Integration tests**: Full approval flow in useChat
3. **E2E tests**: Recording replay with approval flow
4. **Manual testing**: Real API calls with `require_approval: "always"`

## Related Recording

The file `recordings/single-turn-mcp-approval.jsonl` (removed, recreate when implementing) contained a sample approval flow showing:
1. MCP server list tools call
2. Reasoning summary events
3. `mcp_approval_request` output item
4. Response completion (waiting for approval)

This recording can be used to test the UI without making real API calls.
