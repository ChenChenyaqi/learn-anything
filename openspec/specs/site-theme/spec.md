## ADDED Requirements

> **Note:** This spec describes the actual implementation — a custom Vue 3 + Vite application (not VitePress). The architecture uses a fetch-based data layer (`useTopicData` composable) that communicates with a local Node.js HTTP server (`serve.mjs`) running on the same host. The server reads topic files from disk and exposes them as REST endpoints (`/api/topics`, `/api/topics/:slug`, `/api/file`).

### Requirement: Dashboard page shows all topics as cards

The system SHALL render a Dashboard page at the site root (`/`) that scans `/topics/` for all topic directories via `import.meta.glob`, reads each topic's `state.json`, and displays each topic as a card showing the topic name, domain count, total concept count, mastered concept count, and a progress percentage with a thin progress bar. Cards SHALL use VitePress-style design: `bg-soft` background, `divider` border with `brand-2` hover, `rounded-xl` corners.

#### Scenario: Dashboard with multiple topics

- **WHEN** `/topics/` contains subdirectories `javascript/` and `python/`, each with a valid `state.json`
- **THEN** the Dashboard displays two cards, one for "JavaScript" with its progress and one for "Python" with its progress

#### Scenario: Dashboard with no topics

- **WHEN** `/topics/` exists but contains no topic subdirectories with valid `state.json` files
- **THEN** the Dashboard displays a message indicating no topics have been started

#### Scenario: Dashboard with a topic that has no state.json

- **WHEN** `/topics/` contains a subdirectory without a `state.json` file
- **THEN** the Dashboard skips that directory and does not display a card for it

### Requirement: AppSidebar provides dual-context navigation

The system SHALL render an `AppSidebar` component that adapts its content based on a `context` prop:

- **Dashboard context** (`context="dashboard"`): SHALL display a list of all topics with name and mastery stats, each clickable to navigate to `/topics/:slug`
- **Topic context** (`context="topic"`): SHALL display a TOPICS/EXERCISES tab bar, with the topics tab showing a root node (topic name), expandable domain groups, and session file links; and the exercises tab showing expandable concept groups with exercise file links

The sidebar SHALL be 272px wide, use `bg-alt` background, and have no right border — matching VitePress sidebar dimensions.

#### Scenario: Dashboard sidebar shows topics

- **WHEN** the current route is `/` and topics exist
- **THEN** the AppSidebar displays a "Topics" section label and lists each topic with name and mastered/total count

#### Scenario: Topic sidebar shows domain tree

- **WHEN** the current route is `/topics/javascript` and the TOPICS tab is active
- **THEN** the sidebar shows a root node with the topic name (brand-2 color), expandable domain groups with arrow indicators, and session `.md` files under each expanded domain

#### Scenario: Clicking the root node returns to knowledge map

- **WHEN** user clicks the root topic name in the TOPICS tab
- **THEN** the sidebar emits `file-selected` with null, and TopicPage defaults to rendering the knowledge map

#### Scenario: Clicking a session file emits file-selected

- **WHEN** user clicks a session `.md` file in the TOPICS tab
- **THEN** the sidebar emits `file-selected` with `{ path, content, type: 'markdown' }`

#### Scenario: Exercises tab shows concept groups

- **WHEN** user switches to the EXERCISES tab for a topic that has exercise files
- **THEN** the sidebar displays concept groups (expandable) with exercise file links (README.md, starter.js, solution.js, practice JSON files)

#### Scenario: Exercises tab with no exercises

- **WHEN** user switches to the EXERCISES tab and no exercise files exist for the current topic
- **THEN** the sidebar displays a message indicating no exercises are available

#### Scenario: Mobile hamburger menu

- **WHEN** the viewport is below `lg` breakpoint
- **THEN** a hamburger button appears at top-left to toggle sidebar visibility, with a backdrop overlay when open

### Requirement: TopicPage renders knowledge map or selected content

The system SHALL render a TopicPage at `/topics/:slug` that:

- By default (no file selected): renders the topic name as an h1 heading and the rendered `knowledge-map.md` content in a `.prose-content` container
- When a file is selected via `inject('topicSelectedFile')`: renders a `ContentViewer` component with the selected file's content

The content area SHALL NOT be wrapped in a card — it flows naturally with VitePress-style prose styling.

#### Scenario: Topic page default view

- **WHEN** user navigates to `/topics/javascript` with no file selected
- **THEN** the page displays the topic name "JavaScript" and the rendered knowledge map markdown

#### Scenario: Topic page with file selected

- **WHEN** user clicks a session file `2026-06-13.md` in the sidebar for the javascript topic
- **THEN** the TopicPage receives `topicSelectedFile` via inject and renders ContentViewer with the file's markdown content

#### Scenario: Topic page returns to default on route change

- **WHEN** user navigates from `/topics/javascript` to `/topics/python`
- **THEN** the file selection is reset to null and the default knowledge map view is shown

### Requirement: ContentViewer renders Markdown or code

The system SHALL render a `ContentViewer` component that receives a `SelectedFile` object (`{ path, content, type }`) and renders:

- **Markdown** (`type === 'markdown'`): HTML rendered by `markdown-it` into a `.prose-content` div with VitePress-matching typography
- **Code** (`type === 'code'`): a filename label + syntax-highlighted code block using `highlight.js`, with VitePress-style padding and layout

#### Scenario: Markdown file rendering

- **WHEN** ContentViewer receives a file with `type: 'markdown'` and content `# Hello World`
- **THEN** the content is rendered as an `<h1>` inside a `.prose-content` div

#### Scenario: Code file rendering

- **WHEN** ContentViewer receives a file with `type: 'code'`, content `const x = 1;`, and filename `starter.js`
- **THEN** the file shows a filename label "starter.js" and a syntax-highlighted `<pre><code>` block with the JavaScript code

#### Scenario: Empty state

- **WHEN** ContentViewer receives `file: null`
- **THEN** a centered message "Select a file from the sidebar to view its content" is displayed

### Requirement: Language switch toggles UI strings between EN and zh-CN

The system SHALL provide a language switch button in the sidebar footer. When toggled, all UI strings (tab names, section labels, empty states, dashboard text) SHALL change between English and Simplified Chinese. Note content and exercise content SHALL NOT be affected.

#### Scenario: Switch from English to Chinese

- **WHEN** the current UI language is English and user clicks the language switch button
- **THEN** all UI strings change to Chinese and the button label changes to "English"

#### Scenario: Language persists across page loads

- **WHEN** user sets the UI language to Chinese and refreshes the page or navigates to another page
- **THEN** the UI language remains Chinese

#### Scenario: Language does not affect note content

- **WHEN** user switches the UI language
- **THEN** the content of session notes, knowledge map entries, and exercise descriptions is displayed exactly as stored, with no modification

### Requirement: Dark mode toggles between light and dark themes

The system SHALL provide a dark mode toggle button in the sidebar footer. Dark mode state SHALL be persisted in `localStorage` (key: `learn-anything-theme`). On initial load, the system SHALL respect the user's system preference (`prefers-color-scheme: dark`). Dark mode SHALL apply via a `.dark` class on `<html>`, with all color tokens switching to their dark variants.

#### Scenario: Toggle dark mode

- **WHEN** user clicks the dark mode button (sun/moon icon) in the sidebar footer
- **THEN** the `.dark` class is toggled on `<html>` and the preference is saved to localStorage

#### Scenario: Dark mode respects system preference

- **WHEN** a first-time visitor has `prefers-color-scheme: dark` in their OS settings
- **THEN** the site loads in dark mode without requiring manual toggle

### Requirement: VitePress-matching design tokens

The system SHALL define CSS custom properties matching VitePress's design system:

- **Color tokens**: `--color-text-1` (#3c3c43), `--color-text-2` (#67676c), `--color-text-3` (#929295), `--color-bg` (#ffffff), `--color-bg-alt` (#f6f6f7), `--color-bg-soft` (#f6f6f7), `--color-divider` (#e2e2e3), `--color-border` (#c2c2c4), `--color-brand-1/2/3` (red accent)
- **Dark variants**: `--color-text-1` (#dfdfd6), `--color-text-2` (#98989f), `--color-text-3` (#6a6a6f), `--color-bg` (#1b1b1f), etc.
- **Typography**: Inter font family, heading weight 600

#### Scenario: Color tokens render correctly in light mode

- **WHEN** the site loads in light mode
- **THEN** all UI elements use the light color token values

#### Scenario: Color tokens switch correctly in dark mode

- **WHEN** the `.dark` class is added to `<html>`
- **THEN** all color tokens switch to their dark variants via CSS custom properties

### Requirement: Data layer loads topic data via HTTP API

The system SHALL use a fetch-based data layer (`useTopicData` composable) that loads topic data from the local HTTP server (`serve.mjs`) via REST endpoints. The `useTopicData` composable SHALL expose functions (`listAllTopics`, `loadTopic`, `scanSessions`, `scanExercises`, `loadSessionContent`, `loadExerciseContent`) that fetch from `/api/topics`, `/api/topics/:slug`, and `/api/file`. The server reads and caches topic files from the configured `TOPICS_DIR` on disk.

In dev mode, Vite proxies `/api` requests to the `serve.mjs` server running on port 24277. In production, `serve.mjs` serves both static files and API endpoints on a single port.

#### Scenario: Topics are discovered from filesystem at runtime

- **WHEN** the app calls `initTopicData()` and the server has topic directories under `TOPICS_DIR`
- **THEN** `listAllTopics()` returns all topics with summaries fetched from `/api/topics`

#### Scenario: Session files are filtered by domain

- **WHEN** `scanSessions('javascript', 'language-basics')` is called
- **THEN** only `.md` files from the server response under the `language-basics` domain are returned

#### Scenario: Exercise files are grouped by concept

- **WHEN** `scanExercises('javascript')` is called and exercises exist under the topic's exercises directory
- **THEN** files are grouped by their concept subdirectory, with each group containing the concept name and its files

### Requirement: Markdown headings render with anchor links

The Markdown renderer (`utils/markdown.ts`) SHALL inject an `id` attribute on
every rendered heading (`<h1>`–`<h6>`) using a slug derived from the heading
text. The slugify function SHALL preserve Unicode letters and digits (including
CJK characters), lowercase the text, replace whitespace with hyphens, and strip
other characters; duplicate slugs within a document SHALL receive incrementing
`-1`, `-2` suffixes. Each heading SHALL be prefixed with a permalink anchor
(`<a class="header-anchor" href="#<slug>">#</a>`) placed before the heading text.
The anchor SHALL be visually hidden until the heading is hovered, and SHALL use
the brand accent color. The anchor markup SHALL survive the existing DOMPurify
sanitization.

#### Scenario: Heading gets a stable id and anchor

- **WHEN** Markdown containing `## Operators and Control Flow` is rendered
- **THEN** the output contains `<h2 id="...operators-and-control-flow">` with a
  preceding `<a class="header-anchor" href="#...operators-and-control-flow">#</a>`

#### Scenario: Chinese heading produces a deep-linkable slug

- **WHEN** Markdown containing `## 控制流` is rendered
- **THEN** the heading `id` preserves the Chinese characters (e.g.
  `控制流`) so it is deep-linkable

#### Scenario: Duplicate headings receive unique suffixes

- **WHEN** a document contains two `## Overview` headings
- **THEN** the first gets the base slug and the second gets a `-1` suffix, and
  each anchor links to its own heading

#### Scenario: Anchor appears only on hover

- **WHEN** a rendered heading is not hovered
- **THEN** its `.header-anchor` is not visible; when hovered, it becomes visible
  in the brand accent color

#### Scenario: Anchor survives sanitization

- **WHEN** rendered Markdown is passed through DOMPurify
- **THEN** heading `id` attributes and the `.header-anchor` links remain in the
  output

### Requirement: Hash URLs deep-link to a section despite async content

The router SHALL implement hash-aware scroll behavior: when the destination route
has a hash, navigation SHALL scroll to the element matching that hash. Because
note content loads asynchronously after route resolution, the system SHALL
additionally scroll to the hash after the selected file's content is applied to
the DOM (after the next render tick), so that entering or refreshing a URL with a
`#slug` locates the section even when the heading element did not exist when the
router's scroll first ran. A hash that matches no element SHALL not throw.

#### Scenario: Direct URL entry scrolls to the section

- **WHEN** a user navigates directly to
  `/topics/javascript?file=/topics/.../2026-06-13.md#operators` and the file
  content finishes loading
- **THEN** the page scrolls to the heading whose id matches "operators"

#### Scenario: Missing hash does not error

- **WHEN** the route hash does not match any heading after content loads
- **THEN** no error is raised and the page remains at the top

#### Scenario: Knowledge-map section deep-link

- **WHEN** a user enters `/topics/javascript#domains` and the knowledge map
  renders
- **THEN** the page scrolls to the "domains" heading
