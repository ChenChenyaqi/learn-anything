## ADDED Requirements

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
