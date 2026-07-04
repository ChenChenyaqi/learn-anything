## ADDED Requirements

### Requirement: Session storage location and id format

Sessions SHALL be persisted as JSONL files at `<working_folder>/.learn/sessions/<id>.jsonl`. The id SHALL be `<unix_seconds>-<slug>` where `<slug>` is derived from the first user message: lowercased, non-alphanumeric characters replaced with `-`, consecutive dashes collapsed, truncated to 24 characters, empty fallback `session`.

#### Scenario: Id derived from a clean first message

- **WHEN** a new session's first user message is `"Make a hello.txt and run ls"`
- **THEN** the generated id has the form `<unix_seconds>-make-a-hello-txt-and-run-ls`

#### Scenario: Fallback slug for a trivial first message

- **WHEN** the first user message is a single punctuation character or whitespace only
- **THEN** the generated id has the form `<unix_seconds>-session`

### Requirement: JSONL row schema

Each line of a session JSONL file SHALL be a JSON object. Two row shapes are defined: a user row `{ "role": "user", "text": string }` and an assistant row `{ "role": "assistant", "blocks": Block[] }` where each `Block` is either `{ "type": "text", "text": string }` or `{ "type": "tool_call", "id": string, "name": string, "args": object, "status": "running"|"ok"|"error", "result"?: string }`. Append-only writes SHALL be used; partial lines from a crashed process SHALL be skipped on load.

#### Scenario: Append a user row

- **WHEN** the user submits a new message during a run
- **THEN** a user-shaped JSONL row is appended on its own line to the session file

#### Scenario: Append an assistant row with mixed blocks

- **WHEN** an assistant turn completes containing text plus one successful tool call and one failed tool call
- **THEN** one assistant-shaped row is appended with a `blocks` array containing one text block and two tool_call blocks (statuses `ok` and `error`)

#### Scenario: Load skips a malformed trailing line

- **WHEN** a session file's final line was not flushed before a crash and is not valid JSON
- **THEN** loading the session returns the well-formed earlier rows and omits the malformed line without raising an error

### Requirement: Session lifecycle operations

The storage layer SHALL provide `new(working_folder, first_user_message) -> SessionHandle`, `load(id, working_folder) -> Vec<ChatRow>`, `list(working_folder) -> Vec<SessionMeta>`, and `append(handle, row)`. Creating a new session SHALL ensure the `.learn/sessions/` directory exists. `list` SHALL return sessions sorted by `created_at` descending.

#### Scenario: Create then list

- **WHEN** a session is created in an empty working folder and `list` is called immediately after
- **THEN** `list` returns exactly one `SessionMeta` for that session

#### Scenario: Load restores full history

- **WHEN** `load` is called with the id of a session that contains 3 user rows and 2 assistant rows
- **THEN** the returned vector contains 5 rows in submission order

### Requirement: Session metadata derivation

`SessionMeta` SHALL expose `{ id, title, created_at, updated_at, message_count, tool_call_count }`. `title` SHALL be the first user message truncated to 60 characters (no ellipsis when truncated; truncation simply cuts). `created_at` and `updated_at` SHALL be unix seconds derived from the rows on first scan (or file mtime). `message_count` SHALL count both user and assistant rows; `tool_call_count` SHALL sum tool_call blocks across all assistant rows.

#### Scenario: Metadata for a session with 2 user and 1 assistant row containing 3 tools

- **WHEN** `list` scans a session file with 2 user rows and 1 assistant row whose `blocks` include 3 tool_call blocks
- **THEN** the returned `SessionMeta` has `message_count = 3` and `tool_call_count = 3`

#### Scenario: Title truncation

- **WHEN** the first user message is 200 characters long
- **THEN** the returned `title` is exactly the first 60 characters of that message
