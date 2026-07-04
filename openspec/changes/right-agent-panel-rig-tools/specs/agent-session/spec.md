## ADDED Requirements

### Requirement: AgentSession construction

The `learn-agent` crate SHALL expose an `AgentSession` that wires a `LocalModelClient` to a rig agent with all working-folder-scoped tools attached and a domain-specific system prompt referencing the working folder path. The session SHALL own a chat history that accumulates the turn-by-turn transcript.

#### Scenario: Building a session for an OpenAI provider

- **WHEN** a caller constructs `AgentSession::new` with `Provider::OpenAi`, an API key, a model id, a working folder, and a system prompt
- **THEN** the session exposes a `send` method bound to a rig agent whose toolset includes every working-folder-scoped tool

### Requirement: Streaming multi-turn driver

The session's `send(msg)` SHALL drive `agent.stream_prompt(msg)` and produce a stream of unified `AgentEvent` values: `TextDelta { delta }`, `ToolCall { id, name, args }`, `ToolResult { id, name, status, result }`, `Done`, and `Error { message }`. rig's automatic tool-execution loop SHALL be used; the driver SHALL NOT reimplement tool dispatch.

#### Scenario: A run with text and a single tool call

- **WHEN** the model decides to call a tool and then respond with text
- **THEN** the emitted events are, in order: zero or more `TextDelta` (any pre-call text), one `ToolCall`, one `ToolResult`, then one or more `TextDelta`, then `Done`

#### Scenario: A run that errors out

- **WHEN** the underlying rig stream yields a transport error
- **THEN** the driver emits `Error` with the message and stops the stream

### Requirement: Multi-turn depth bound

The session SHALL configure the rig agent with a generous multi-turn depth (default 32 turns) so that ordinary "think → tool → think" tasks do not hit `MaxDepthError`. The depth SHALL be tunable via the session builder.

#### Scenario: A long task within the depth bound

- **WHEN** the model executes several tool calls across up to 32 turns
- **THEN** the run completes without `MaxDepthError`

#### Scenario: Hitting the depth bound

- **WHEN** the model attempts more than the configured depth of turns
- **THEN** the driver emits an `Error` naming the depth limit instead of returning partially truncated results silently

### Requirement: System-prompt construction

The session SHALL build the system prompt via a pure function that takes the working folder path and the list of available tool names, so the prompt text is unit-testable independently of rig. The prompt SHALL instruct the model to prefer `EditFile` over rewriting whole files with `WriteFile`, to use small unique `old` strings when editing, and to repair after edits by running the appropriate typecheck or build command.

#### Scenario: Pure-prompt construction

- **WHEN** the pure system-prompt function is called with `Path("/d/learn")` and tool names `["read_file","write_file","edit_file","list_dir","grep","glob","run_command"]`
- **THEN** the returned prompt string mentions the absolute working folder path and each tool name

### Requirement: Cancellation

The session SHALL support cancellation of an in-flight `send` via a shared cancellation signal. When the signal fires, the driver SHALL stop polling the rig stream as promptly as possible and emit `Error { message: "cancelled" }`.

#### Scenario: Cancel during a long run

- **WHEN** the caller triggers cancellation while a multi-turn run is mid-stream
- **THEN** the run emits `Error { message: "cancelled" }` within a bounded number of stream polls and no further events are emitted for that run
