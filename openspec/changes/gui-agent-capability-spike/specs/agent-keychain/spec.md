## ADDED Requirements

### Requirement: Store API key in the OS keychain

The system SHALL store the user's LLM API key using the operating system's secure credential store (keychain), keyed by a stable application-specific identifier.

#### Scenario: Saving a key

- **WHEN** the user submits an API key to be saved
- **THEN** the key is written to the OS keychain under the application's identifier

### Requirement: Retrieve API key from the OS keychain

The system SHALL retrieve the stored API key from the OS keychain on demand so the agent layer can use it, without requiring the user to re-enter it each session.

#### Scenario: Loading a saved key

- **WHEN** the application starts and a key has previously been saved
- **THEN** the key can be read from the keychain for use by the agent layer

#### Scenario: No key present

- **WHEN** the application requests the key and none has been saved
- **THEN** the system indicates that no key is configured (and does not error)

### Requirement: No plaintext persistence of the key

The system MUST NOT write the API key to any plaintext file, environment-variable config file, or log output.

#### Scenario: Key is absent from plaintext config

- **WHEN** the user saves an API key and the application data directory is inspected
- **THEN** the API key does not appear in any plaintext file under the application data directory

#### Scenario: Key is not logged

- **WHEN** the application logs request or error information
- **THEN** the API key is never included in log output

### Requirement: Verify a key with a test request

The system SHALL provide a "test key" action that performs a single short LLM request against the configured provider using the stored key, and reports success or failure to the user.

#### Scenario: Valid key passes the test

- **WHEN** the user triggers the test action with a valid key and reachable provider endpoint
- **THEN** the system reports success

#### Scenario: Invalid or unreachable key fails the test

- **WHEN** the user triggers the test action with an invalid key or an unreachable provider endpoint
- **THEN** the system reports failure with the underlying error reason
