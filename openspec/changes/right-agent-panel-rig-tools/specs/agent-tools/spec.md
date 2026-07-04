## ADDED Requirements

### Requirement: Working-folder scope enforcement

Every filesystem tool MUST reject any path that resolves outside the canonical working folder. The resolved (canonicalized) target path MUST start with the canonicalized working-folder path; otherwise the tool SHALL return an error without performing the operation.

#### Scenario: Model requests a path inside the working folder

- **WHEN** the tool resolves the requested path and the canonical target is within the canonicalized working folder
- **THEN** the tool performs the read/write/list/edit and returns the result

#### Scenario: Model requests a path with `..` that escapes the working folder

- **WHEN** the requested path contains `..` segments that resolve outside the working folder after canonicalization
- **THEN** the tool returns an error string indicating the resolved path was outside the workspace and performs no filesystem mutation

#### Scenario: An unchanged prefix is re-canonicalized per call

- **WHEN** the working folder moves or is replaced between tool calls within the same session
- **THEN** the tool re-derives the canonical working-folder prefix from the session-bound path and rejects targets outside the new prefix

### Requirement: ReadFile tool

The `ReadFile` tool SHALL read a UTF-8 text file inside the working folder and return its contents prefixed with 1-indexed line numbers (`<N>: <content>`). The caller MAY supply an `offset` (1-indexed line to start from, default 1) and a `limit` (maximum number of lines to return, default to end of file) so that large files can be paged through incrementally. Lines longer than 2000 characters SHALL be truncated with an in-line marker noting the original character count. Total output exceeding 200 KB SHALL be truncated with an appended marker that directs the caller to narrow the range with `offset`/`limit`.

#### Scenario: Read an existing text file

- **WHEN** the tool is called with a path to an existing text file inside the working folder
- **THEN** the tool returns the file's text prefixed with 1-indexed line numbers (`<N>: <content>`)

#### Scenario: Read a range of lines with offset and limit

- **WHEN** the tool is called with `offset = 50` and `limit = 20` on a file with 100 lines
- **THEN** the tool returns lines 50 through 69 with their original file line numbers (50, 51, ...), not renumbered from 1

#### Scenario: Offset past end of file

- **WHEN** the `offset` exceeds the number of lines in the file
- **THEN** the tool returns a human-readable indicator stating the offset is past end of file and the total line count, so the caller can correct its request

#### Scenario: Read a file with a line longer than 2000 characters

- **WHEN** a single line in the returned range exceeds 2000 characters
- **THEN** the tool truncates that line to 2000 characters and appends an in-line marker stating the original character count

#### Scenario: Read a range whose total output exceeds 200 KB

- **WHEN** the assembled line-numbered output exceeds 200 KB
- **THEN** the tool truncates the output to 200 KB on a line boundary and appends a marker directing the caller to use a smaller `limit` or a higher `offset`

#### Scenario: Read a non-existent file

- **WHEN** the requested path does not exist
- **THEN** the tool returns an error indicating the file was not found

### Requirement: WriteFile tool

The `WriteFile` tool SHALL write UTF-8 text to a file inside the working folder, creating the file if it does not exist and overwriting it if it does. Missing parent directories SHALL be created. The tool SHALL refuse to write when the resolved path is outside the working folder and refuse to overwrite a directory.

#### Scenario: Write a new file

- **WHEN** the tool is called with a path to a non-existent file inside the working folder
- **THEN** the tool creates the file (and any missing parent directories) with the given contents and returns a success note including bytes written

#### Scenario: Overwrite an existing file

- **WHEN** the target file exists and is a regular file
- **THEN** the tool overwrites its contents and returns a success note

#### Scenario: Write to a path that is a directory

- **WHEN** the target path resolves to an existing directory
- **THEN** the tool returns an error indicating the target is a directory and performs no write

### Requirement: EditFile tool

The `EditFile` tool SHALL perform an exact string substitution in an existing file inside the working folder. When `replace_all` is false the operation SHALL fail if the `old` string is not found exactly once; when true it SHALL replace every occurrence. The tool SHALL fail with a clear error when `old` equals `new`.

#### Scenario: Single occurrence replace

- **WHEN** `replace_all` is false and `old` appears exactly once in the file
- **THEN** the tool replaces that occurrence with `new` and returns a success note

#### Scenario: No occurrence

- **WHEN** `replace_all` is false and `old` does not appear in the file
- **THEN** the tool returns an error indicating the string was not found and does not modify the file

#### Scenario: Multiple occurrences with replace_all false

- **WHEN** `replace_all` is false and `old` appears more than once
- **THEN** the tool returns an error listing the occurrence count and does not modify the file

#### Scenario: Replace all occurrences

- **WHEN** `replace_all` is true
- **THEN** the tool replaces every occurrence of `old` with `new` and returns the number of replacements made

### Requirement: ListDir tool

The `ListDir` tool SHALL list the entries of a directory inside the working folder. Directories SHALL be suffixed with `/`. Entries named `node_modules`, `target`, or `.git` SHALL be excluded; other dotfile entries (e.g. `.learn`, `.github`, `.env`) SHALL be listed so the agent can navigate them. The result SHALL be a flat string, one entry per line, entries sorted alphabetically.

#### Scenario: List a non-empty directory

- **WHEN** the tool is called with a directory path inside the working folder that contains multiple entries including dotfiles and ignored dirs
- **THEN** the tool returns a newline-separated list of entry names, directories suffixed with `/`, listing dotfile entries but excluding `node_modules`/`target`/`.git`, sorted alphabetically

#### Scenario: List inside a dotfile directory

- **WHEN** the tool is called with a path like `.learn/sessions`
- **THEN** the tool lists the entries of that dotfile directory the same as any other directory

#### Scenario: List a path that is a file

- **WHEN** the target path resolves to a regular file rather than a directory
- **THEN** the tool returns an error indicating the target is not a directory

### Requirement: Grep tool

The `Grep` tool SHALL search file contents inside the working folder using a regex pattern, optionally limited to a subdirectory and/or a file-name glob. Results SHALL be returned as `path:line_number:matched_line` entries, capped at 100 results. The tool SHALL search dotfile directories (e.g. `.learn`, `.github`) but skip `node_modules`, `target`, and `.git`. The tool SHALL use ripgrep when available (`--hidden --no-ignore-vcs` with explicit `--glob '!node_modules'`/`'!target'`/`'!.git'` exclusions) and fall back to a pure-Rust regex walk when ripgrep is not present or returns an internal error.

#### Scenario: Search with a matching pattern

- **WHEN** the tool is called with a regex that matches at least one line in the working folder
- **THEN** the tool returns up to 100 `path:line:line` entries

#### Scenario: Search with no matches

- **WHEN** no file in scope contains the pattern
- **THEN** the tool returns an empty result set indicator

#### Scenario: Search descends into dotfile directories

- **WHEN** a match exists under a dotfile directory such as `.learn` and another under `.git`
- **THEN** the `.learn` match is returned and the `.git` match is not

### Requirement: Glob tool

The `Glob` tool SHALL return file paths inside the working folder that match a glob pattern (recursively). Results SHALL be sorted alphabetically and capped at 500 paths. The walker SHALL prune `node_modules`, `target`, and `.git` so broad patterns are not swamped by build artifacts; other dotfile directories (e.g. `.learn`, `.github`) SHALL be included.

#### Scenario: Match a simple glob

- **WHEN** the tool is called with a pattern like `**/Cargo.toml`
- **THEN** the tool returns all matching paths under the working folder, sorted and capped at 500

#### Scenario: Ignore-listed directories are pruned

- **WHEN** the tool is called with `**/*.rs` and matching files exist under both `src/` and `target/`
- **THEN** only the `src/` matches are returned; `target/` matches are excluded

### Requirement: RunCommand tool

The `RunCommand` tool SHALL execute a command (with explicit args, no shell) with `cwd` set to the working folder. stdout and stderr SHALL be captured **concurrently** (not serially, to avoid pipe deadlock when one stream fills the OS buffer), each reported with the first 4 KB of content plus a truncation marker stating the original byte count when the stream exceeded 4 KB. The tool SHALL impose a 120-second wall-clock timeout and kill the child if exceeded.

#### Scenario: Run a fast command that exits 0

- **WHEN** the model calls the tool with a command that finishes successfully within the timeout
- **THEN** the tool returns the captured stdout, stderr, and exit code 0

#### Scenario: Run a command that exceeds the timeout

- **WHEN** a spawned command does not terminate within 120 seconds
- **THEN** the tool kills the child process and returns an error result stating the command timed out

#### Scenario: Run a non-existent command

- **WHEN** the requested executable does not exist on PATH
- **THEN** the tool returns an error stating the command was not found

#### Scenario: Run a command that produces more than 4 KB of stdout

- **WHEN** the captured stdout exceeds 4 KB
- **THEN** the tool returns the first 4 KB of stdout and appends a truncation marker stating the original byte count

#### Scenario: Run a command that produces enough stdout to fill the OS pipe buffer

- **WHEN** a command writes more than ~64 KB to stdout (enough to fill the OS pipe buffer)
- **THEN** the tool still completes and returns exit 0 with a truncation marker, rather than deadlocking until the timeout

### Requirement: Tool error feedback to the model

When any tool operation fails (rejected path, missing file, command failure, timeout), the tool SHALL return a `ToolResult` with `status = "error"` and a human-readable message string, so the model can react to the failure in a subsequent turn rather than the loop silently aborting.

#### Scenario: Tool call fails one turn and the model continues

- **WHEN** a tool returns an error result during an agent run
- **THEN** the next `TextDelta` after the tool result may contain the model's reaction, and the run does not terminate solely because of the tool error
