## SUPERSEDED

> **Status: Superseded.** The `SiteGenerator` class and `src/site/files.ts` have been removed. Site files are now pre-built via `vite build` into `site-dist/` at publish time and shipped in the npm package. The `serve` command directly spawns the pre-built HTTP server — no runtime file generation or `npm install` required.

Archived requirements follow for historical reference:

---

### Requirement: SiteGenerator writes all template files on first generation

The system SHALL write all site template files (Vue components, composables, styles, router, config files, package.json) to the `.learn/` directory when the `SiteGenerator.generate()` method is called and the target directory has no existing site setup.

#### Scenario: First generation creates complete directory structure

- **WHEN** `SiteGenerator.generate()` is called and `.learn/src/` does not exist
- **THEN** the system creates `.learn/package.json`, `.learn/index.html`, `.learn/vite.config.ts`, `.learn/tsconfig.json`, `.learn/src/main.ts`, `.learn/src/App.vue`, `.learn/src/router/index.ts`, all component files under `.learn/src/components/`, all composable files under `.learn/src/composables/`, all style files under `.learn/src/styles/`, all utility files under `.learn/src/utils/`, and `.learn/.gitignore`

#### Scenario: First generation writes theme components

- **WHEN** `SiteGenerator.generate()` is called for the first time
- **THEN** all files under `src/components/`, `src/composables/`, and `src/styles/` are written to disk

### Requirement: SiteGenerator preserves theme files on subsequent generation

The system SHALL skip writing component, composable, and style files if they already exist, unless the `--force` option is passed.

#### Scenario: Subsequent generation skips existing theme files

- **WHEN** `SiteGenerator.generate()` is called and `.learn/src/components/Dashboard.vue` already exists
- **THEN** the system does NOT overwrite `Dashboard.vue` or any other existing file under `src/components/`, `src/composables/`, or `src/styles/`

#### Scenario: Force flag overwrites theme files

- **WHEN** `SiteGenerator.generate({ force: true })` is called
- **THEN** the system overwrites ALL component/composable/style files regardless of whether they already exist

### Requirement: SiteGenerator always overwrites config files

The system SHALL always overwrite `vite.config.ts`, `tsconfig.json`, `index.html`, `package.json`, and `src/main.ts` on every generation, regardless of whether they already exist.

#### Scenario: Subsequent generation overwrites config files

- **WHEN** `SiteGenerator.generate()` is called and `vite.config.ts` already exists
- **THEN** the system overwrites `vite.config.ts` with the latest template content

#### Scenario: Subsequent generation overwrites package.json

- **WHEN** `SiteGenerator.generate()` is called and `package.json` already exists
- **THEN** the system overwrites `package.json` with the latest template content

### Requirement: SiteGenerator writes .gitignore

The system SHALL write `.learn/.gitignore` with entries for `node_modules/` and `dist/` on every generation.

#### Scenario: .gitignore is created or updated

- **WHEN** `SiteGenerator.generate()` is called
- **THEN** `.learn/.gitignore` exists and contains at minimum `node_modules/` and `dist/`

### Requirement: SiteGenerator uses embedded file content

The system SHALL read all template file content from `packages/cli/src/site/files.ts`, which exports `SITE_FILES` as a `Record<string, string>` mapping relative file paths to file content strings. The `SiteGenerator` class SHALL NOT read from the filesystem at runtime to obtain template content.

#### Scenario: Template content comes from embedded mapping

- **WHEN** `SiteGenerator.generate()` writes a file to `.learn/`
- **THEN** the file content is sourced from the `SITE_FILES` constant, not from reading `packages/cli/site/` or any other directory on disk
