## ADDED Requirements

> **Status: Implemented.** The `serve` command is fully functional. Site files are pre-built via `vite build` and shipped in the npm package as `site-dist/`. The `serve` command spawns a Node.js HTTP server from the pre-built static files. No `--site` flag needed on `init`/`update` — the dashboard works out of the box.

### Requirement: serve command starts HTTP server from pre-built site

The system SHALL provide a `learn-anything serve [path]` command that: (1) ensures `.learn/topics/` exists, (2) spawns `node serve.mjs` from the bundled `site-dist/` directory, and (3) prints the local URL to the console with an option to auto-open the browser.

The system SHALL NOT require `npm install` or any package installation at runtime. The site files are pre-built at publish time via `vite build` and included in the npm package.

#### Scenario: serve starts the dashboard server

- **WHEN** user runs `learn-anything serve` in a project directory
- **THEN** the system spawns the pre-built HTTP server from `site-dist/` and prints the local URL

#### Scenario: serve handles missing .learn directory

- **WHEN** user runs `learn-anything serve` in a project that has no `.learn/` directory
- **THEN** the system creates `.learn/topics/` and proceeds to start the server

#### Scenario: serve shows warning for empty topics

- **WHEN** user runs `learn-anything serve` and `.learn/topics/` is empty
- **THEN** the system starts the server but prints a warning that no topics were found

### Requirement: serve supports optional port and open flags

The system SHALL support `--port <number>` to specify the HTTP server port and `--no-open` to prevent automatic browser opening on `serve`.

#### Scenario: serve with custom port

- **WHEN** user runs `learn-anything serve --port 8080`
- **THEN** the HTTP server starts on port 8080

#### Scenario: serve without opening browser

- **WHEN** user runs `learn-anything serve --no-open`
- **THEN** the HTTP server starts but the system does NOT open the browser automatically

### Requirement: serve forwards exit signals cleanly

The system SHALL forward SIGINT and SIGTERM signals from the CLI process to the server child process, and SHALL clean up the child process when the user presses Ctrl+C.

#### Scenario: Ctrl+C stops the dev server

- **WHEN** user presses Ctrl+C while the server is running
- **THEN** the server child process terminates and the CLI exits cleanly
