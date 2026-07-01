## ADDED Requirements

### Requirement: ModelClient abstraction trait

The system SHALL define a Rust `ModelClient` trait that the learning-workflow logic depends on, exposing at least streaming completion and typed structured extraction. The workflow logic MUST depend only on this trait and MUST NOT depend on a concrete provider implementation.

#### Scenario: Workflow depends on the trait

- **WHEN** the learn-topic workflow code is compiled
- **THEN** it references the `ModelClient` trait, not any concrete client struct

### Requirement: LocalModelClient backed by rig

The system SHALL provide a `LocalModelClient` that implements `ModelClient` using the `rig` crate, supporting OpenAI-compatible and Anthropic providers, configured with a user-supplied API key and an optional `base_url` (so OpenRouter and OpenAI-compatible proxies are usable).

#### Scenario: OpenAI-compatible provider call

- **WHEN** `LocalModelClient` is configured with an OpenAI-compatible provider, a key, and a base URL, and a completion is requested
- **THEN** the request is sent to the configured base URL using the supplied key

#### Scenario: Anthropic provider call

- **WHEN** `LocalModelClient` is configured with the Anthropic provider and a key, and a completion is requested
- **THEN** the request is sent to Anthropic using the supplied key

### Requirement: Streaming completion

The `ModelClient` trait SHALL expose a streaming completion operation that yields incremental token deltas, and `LocalModelClient` SHALL implement it via `rig`'s streaming API.

#### Scenario: Deltas are yielded incrementally

- **WHEN** a streaming completion is requested from `LocalModelClient`
- **THEN** token deltas are yielded as they arrive from the provider, not only after completion

### Requirement: Typed structured extraction

The `ModelClient` trait SHALL expose a structured-extraction operation that produces a caller-specified Rust type, and `LocalModelClient` SHALL implement it via `rig`'s extractor (target type `serde::Deserialize` + `schemars::JsonSchema`).

#### Scenario: Extraction returns a typed value

- **WHEN** extraction is requested for a target type `T` against some prompt text
- **THEN** the result is a validated `T` value (or an error), never an untyped string

### Requirement: RemoteModelClient stub for subscription mode

The system SHALL provide a `RemoteModelClient` that implements `ModelClient` by forwarding requests to a remote subscription server. In Phase 1 this implementation SHALL be a stub that returns a "not implemented" error for every operation, preserving the seam for the future subscription backend where the server holds the API key.

#### Scenario: Stub is not usable yet

- **WHEN** any `ModelClient` operation is invoked on `RemoteModelClient`
- **THEN** it returns a "not implemented" error without contacting any server

### Requirement: Provider is decoupled from workflow via the trait

The system SHALL allow the concrete `ModelClient` implementation to be swapped (local vs. remote) without changing the workflow logic, by injecting the trait implementation at the call site.

#### Scenario: Swapping backends does not touch workflow code

- **WHEN** a `LocalModelClient` is replaced with a `RemoteModelClient` at the injection point
- **THEN** the workflow logic compiles and runs unchanged
