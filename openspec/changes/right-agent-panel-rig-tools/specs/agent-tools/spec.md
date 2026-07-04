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

The `ReadFile` tool SHALL read a UTF-8 text file inside the working folder and return its contents. Files larger than 200 KB SHALL be truncated with an appended marker indicating the truncation and the original byte size.

#### Scenario: Read an existing text file

- **WHEN** the tool is called with a path to an existing text file inside the working folder
- **THEN** the tool returns the file's text contents as a string

#### Scenario: Read a file larger than the size limit

- **WHEN** the target file exceeds 200 KB
- **THEN** the tool returns the first 200 KB of text followed by a truncation marker stating the original size in bytes

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

The `ListDir` tool SHALL list the entries of a directory inside the working folder. Directories SHALL be suffixed with `/`; hidden entries (starting with `.`) and entries in a small ignore list (`node_modules`, `target`, `.git`) SHALL be excluded by default. The result SHALL be a flat string, one entry per line, entries sorted alphabetically.

#### Scenario: List a non-empty directory

- **WHEN** the tool is called with a directory path inside the working folder that contains multiple entries
- **THEN** the tool returns a newline-separated list of entry names, directories suffixed with `/`, excluding hidden and ignore-listed entries, sorted alphabetically

#### Scenario: List a path that is a file

- **WHEN** the target path resolves to a regular file rather than a directory
- **THEN** the tool returns an error indicating the target is not a directory

### Requirement: Grep tool

The `Grep` tool SHALL search file contents inside the working folder using a regex pattern, optionally limited to a subdirectory and/or a file-name glob. Results SHALL be returned as `path:line_number:matched_line` entries, capped at 100 results. The tool SHALL use ripgrep when available and fall back to a pure-Rust regex walk when it is not.

#### Scenario: Search with a matching pattern

- **WHEN** the tool is called with a regex that matches at least one line in the working folder
- **THEN** the tool returns up to 100 `path:line:line` entries

#### Scenario: Search with no matches

- **WHEN** no file in scope contains the pattern
- **THEN** the tool returns an empty result set indicator

### Requirement: Glob tool

The `Glob` tool SHALL return file paths inside the working folder that match a glob pattern (recursively). Results SHALL be sorted alphabetically and capped at 500 paths.

#### Scenario: Match a simple glob

- **WHEN** the tool is called with a pattern like `**/Cargo.toml`
- **THEN** the tool returns all matching paths under the working folder, sorted and capped at 500

### Requirement: RunCommand tool

The `RunCommand` tool SHALL execute a command (with explicit args, no shell) with `cwd` set to the working folder. stdout and stderr SHALL be captured, each truncated to 4 KB with a truncation marker, and returned together with the exit code. The tool SHALL impose a 120-second wall-clock timeout and kill the child if exceeded.

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
- **THEN** the tool truncates the returned stdout to 4 KB and appends a truncation marker stating the original byte count

### Requirement: Tool error feedback to the model

When any tool operation fails (rejected path, missing file, command failure, timeout), the tool SHALL return a `ToolResult` with `status = "error"` and a human-readable message string, so the model can react to the failure in a subsequent turn rather than the loop silently aborting.

#### Scenario: Tool call fails one turn and the model continues

- **WHEN** a tool returns an error result during an agent run
- **THEN** the next `TextDelta` after the tool result may contain the model's reaction, and the run does not terminate solely because of the tool error
