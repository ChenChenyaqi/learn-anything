//! `ModelClient` abstraction: the BYOK/subscription seam.
//!
//! [`ModelClient`] is the single trait all learning workflows depend on. It
//! provides two operations:
//! - [`stream`](ModelClient::stream): streaming completion yielding text deltas
//! - [`extract`](ModelClient::extract): typed structured extraction into `T`
//!
//! Three implementations are provided:
//! - [`LocalModelClient`] — wraps `rig`, bound to the user's API key (BYOK).
//! - [`RemoteModelClient`] — stub for the future subscription server.
//! - [`FakeModelClient`] — offline test double.

use anyhow::anyhow;
use futures::stream::{BoxStream, StreamExt};
use futures::Future;
use rig_core::agent::{MultiTurnStreamItem, StreamingError};
use rig_core::client::CompletionClient;
use rig_core::completion::GetTokenUsage;
use rig_core::providers::{anthropic, openai};
use rig_core::streaming::{StreamedAssistantContent, StreamingPrompt};
use schemars::JsonSchema;
use serde::de::DeserializeOwned;
use serde::Serialize;

/* ================================================================== */
/*  Trait                                                             */
/* ================================================================== */

/// The LLM backend seam.
///
/// All learning workflows depend on this trait and never on a concrete
/// provider implementation. The concrete backend is injected at the call site
/// (e.g. `LocalModelClient` for BYOK mode, `RemoteModelClient` for
/// subscription mode, `FakeModelClient` in tests), so swapping backends
/// requires no workflow-code changes.
///
/// The trait is intentionally minimal:
/// - [`stream`](ModelClient::stream) yields incremental text deltas for
///   real-time UI feedback.
/// - [`extract`](ModelClient::extract) returns a typed `T` via structured
///   output (the model fills a JSON schema; `rig` deserializes it).
///
/// # Object safety
///
/// This trait is **intentionally not object-safe**: the methods return
/// `impl Future` (RPITIT) instead of `Pin<Box<dyn Future>>`. All dispatch is
/// generic/monomorphized, which is zero-cost and keeps every backend
/// statically verifiable. If dynamic dispatch (`Box<dyn ModelClient>`) is ever
/// required — e.g. choosing a backend at runtime — switch the return types to
/// boxed futures or adopt `async-trait`.
pub trait ModelClient: Send + Sync {
    /// Stream a completion, yielding incremental text deltas.
    fn stream(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> impl Future<Output = anyhow::Result<BoxStream<'static, anyhow::Result<String>>>> + Send;

    /// Extract a typed value `T` from the model using structured output.
    ///
    /// `T` must implement [`JsonSchema`] (so the schema can be sent to the
    /// model), [`serde::Deserialize`], and [`serde::Serialize`].
    fn extract<T>(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> impl Future<Output = anyhow::Result<T>> + Send
    where
        T: JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static;
}

/* ================================================================== */
/*  Provider enum                                                     */
/* ================================================================== */

/// Which LLM provider to use with [`LocalModelClient`].
///
/// Serializes to lowercase strings (`"openai"` / `"anthropic"`) so it can be
/// stored in the app's plaintext config and round-tripped to/from the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    /// OpenAI-compatible (also works with OpenRouter, Azure OpenAI, local
    /// servers, etc. via an optional `base_url`).
    #[default]
    OpenAi,
    /// Anthropic (Claude).
    Anthropic,
}

/* ================================================================== */
/*  LocalModelClient                                                  */
/* ================================================================== */

/// BYOK model client backed by [`rig`]. The API key stays local; requests go
/// directly from the user's machine to the configured provider endpoint.
#[derive(Clone)]
pub struct LocalModelClient {
    provider: Provider,
    api_key: String,
    base_url: Option<String>,
    model: String,
}

/// Custom `Debug`: never prints the raw API key, so logging a client (error
/// chains, `tracing`, `{:?}`) cannot leak the user's secret.
impl std::fmt::Debug for LocalModelClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LocalModelClient")
            .field("provider", &self.provider)
            .field("api_key", &"<redacted>")
            .field("base_url", &self.base_url)
            .field("model", &self.model)
            .finish()
    }
}

/// Provider-specific rig client, produced by [`LocalModelClient::build_client`].
/// Lets `stream` / `extract` dispatch over the provider without re-running the
/// builder (and the `base_url` branch) on every call.
enum RigClient {
    OpenAi(openai::Client),
    Anthropic(anthropic::Client),
}

impl LocalModelClient {
    /// Create a new local client.
    ///
    /// - `provider` — which provider API to target.
    /// - `api_key` — the user's secret key (from the OS keychain).
    /// - `base_url` — optional override (e.g. an OpenRouter or self-hosted
    ///   endpoint). `None` uses the provider's default URL.
    /// - `model` — the model id (e.g. `"gpt-4o"`, `"claude-sonnet-4-20250514"`).
    pub fn new(
        provider: Provider,
        api_key: impl Into<String>,
        base_url: Option<String>,
        model: impl Into<String>,
    ) -> Self {
        Self {
            provider,
            api_key: api_key.into(),
            base_url,
            model: model.into(),
        }
    }

    /// Build the provider-specific rig client, applying the optional
    /// `base_url` override. Centralizes the provider × base_url branching so
    /// [`ModelClient::stream`] / [`ModelClient::extract`] each stay a single
    /// flat `match` instead of repeating the builder boilerplate.
    fn build_client(&self) -> anyhow::Result<RigClient> {
        let key = self.api_key.as_str();
        match self.provider {
            Provider::OpenAi => {
                let mut builder = openai::Client::builder().api_key(key);
                if let Some(url) = &self.base_url {
                    builder = builder.base_url(url.as_str());
                }
                Ok(RigClient::OpenAi(builder.build()?))
            }
            Provider::Anthropic => {
                let mut builder = anthropic::Client::builder().api_key(key);
                if let Some(url) = &self.base_url {
                    builder = builder.base_url(url.as_str());
                }
                Ok(RigClient::Anthropic(builder.build()?))
            }
        }
    }
}

/// Map a rig streaming-response into a `BoxStream<Result<String>>` that yields
/// only assistant text deltas (ignoring tool calls, reasoning, metadata, etc.).
fn text_only_stream<R, S>(stream: S) -> BoxStream<'static, anyhow::Result<String>>
where
    R: Clone + Unpin + GetTokenUsage + Send + 'static,
    S: futures::Stream<Item = Result<MultiTurnStreamItem<R>, StreamingError>> + Send + 'static,
{
    let text = stream.filter_map(|item| async move {
        match item {
            Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(text))) => {
                Some(Ok(text.text))
            }
            Ok(_) => None,
            Err(e) => Some(Err(e.into())),
        }
    });
    Box::pin(text)
}

impl ModelClient for LocalModelClient {
    async fn stream(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> anyhow::Result<BoxStream<'static, anyhow::Result<String>>> {
        let model = &self.model;
        match self.build_client()? {
            RigClient::OpenAi(client) => {
                let agent = client.agent(model).preamble(system_prompt).build();
                let stream = agent.stream_prompt(user_prompt).await;
                Ok(text_only_stream(stream))
            }
            RigClient::Anthropic(client) => {
                let agent = client.agent(model).preamble(system_prompt).build();
                let stream = agent.stream_prompt(user_prompt).await;
                Ok(text_only_stream(stream))
            }
        }
    }

    async fn extract<T>(&self, system_prompt: &str, user_prompt: &str) -> anyhow::Result<T>
    where
        T: JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static,
    {
        let model = &self.model;
        match self.build_client()? {
            RigClient::OpenAi(client) => {
                let extractor = client.extractor::<T>(model).preamble(system_prompt).build();
                Ok(extractor.extract(user_prompt).await?)
            }
            RigClient::Anthropic(client) => {
                let extractor = client.extractor::<T>(model).preamble(system_prompt).build();
                Ok(extractor.extract(user_prompt).await?)
            }
        }
    }
}

/* ================================================================== */
/*  RemoteModelClient (stub)                                          */
/* ================================================================== */

/// Placeholder for the future subscription server. Every operation returns
/// a "not implemented" error. This preserves the [`ModelClient`] seam so that
/// subscription mode is a later backend swap, not a rewrite.
#[derive(Debug, Clone, Default)]
pub struct RemoteModelClient {
    /// URL of the future subscription server (unused in Phase 1).
    pub server_url: Option<String>,
}

impl RemoteModelClient {
    /// Create with an explicit server URL.
    pub fn new(server_url: impl Into<String>) -> Self {
        Self {
            server_url: Some(server_url.into()),
        }
    }
}

const NOT_IMPLEMENTED: &str =
    "RemoteModelClient is not implemented yet (subscription mode is a future feature)";

impl ModelClient for RemoteModelClient {
    async fn stream(
        &self,
        _system_prompt: &str,
        _user_prompt: &str,
    ) -> anyhow::Result<BoxStream<'static, anyhow::Result<String>>> {
        Err(anyhow!(NOT_IMPLEMENTED))
    }

    async fn extract<T>(&self, _system_prompt: &str, _user_prompt: &str) -> anyhow::Result<T>
    where
        T: JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static,
    {
        Err(anyhow!(NOT_IMPLEMENTED))
    }
}

/* ================================================================== */
/*  FakeModelClient (test double)                                     */
/* ================================================================== */

/// Offline test double. Yields canned streaming deltas and a canned extracted
/// value. Keeps workflow tests fast, deterministic, and offline.
#[derive(Debug, Clone)]
pub struct FakeModelClient {
    /// Deltas yielded by [`stream`](ModelClient::stream), in order.
    pub stream_deltas: Vec<String>,
    /// JSON string deserialized and returned by [`extract`](ModelClient::extract).
    pub extracted_json: String,
}

impl FakeModelClient {
    /// Create with the given canned responses.
    pub fn new(stream_deltas: Vec<String>, extracted_json: impl Into<String>) -> Self {
        Self {
            stream_deltas,
            extracted_json: extracted_json.into(),
        }
    }
}

impl ModelClient for FakeModelClient {
    async fn stream(
        &self,
        _system_prompt: &str,
        _user_prompt: &str,
    ) -> anyhow::Result<BoxStream<'static, anyhow::Result<String>>> {
        let deltas: Vec<anyhow::Result<String>> =
            self.stream_deltas.iter().cloned().map(Ok).collect();
        Ok(Box::pin(futures::stream::iter(deltas)))
    }

    async fn extract<T>(&self, _system_prompt: &str, _user_prompt: &str) -> anyhow::Result<T>
    where
        T: JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static,
    {
        Ok(serde_json::from_str(&self.extracted_json)?)
    }
}

/* ================================================================== */
/*  Tests                                                             */
/* ================================================================== */

#[cfg(test)]
mod tests {
    use super::*;

    // ─── A mini-workflow that depends ONLY on the trait ────────────

    /// This function represents "workflow code". It takes any `ModelClient`
    /// and uses both `stream` and `extract`. If the trait or any impl changes
    /// incompatibly, this function stops compiling.
    async fn mini_workflow<C: ModelClient>(client: &C, prompt: &str) -> anyhow::Result<String> {
        let stream = client.stream("You are helpful.", prompt).await?;
        let mut text = String::new();
        tokio::pin!(stream);
        while let Some(delta) = stream.next().await {
            text.push_str(&delta?);
        }
        Ok(text)
    }

    // ── 3.5: Workflow depends on the trait, not concrete impl ──────

    #[tokio::test]
    async fn workflow_runs_with_fake() {
        let fake = FakeModelClient::new(vec!["hello".into(), " world".into()], "{}");
        let result = mini_workflow(&fake, "hi").await.unwrap();
        assert_eq!(result, "hello world");
    }

    #[test]
    fn workflow_compiles_with_all_impls() {
        // Compile-time proof: the SAME generic function accepts every backend.
        // If any backend failed to implement ModelClient, this wouldn't compile.
        fn requires_model_client<C: ModelClient>(_c: &C) {}
        requires_model_client(&LocalModelClient::new(
            Provider::OpenAi,
            "key",
            None,
            "gpt-4o",
        ));
        requires_model_client(&LocalModelClient::new(
            Provider::Anthropic,
            "key",
            Some("https://custom.example.com".into()),
            "claude-sonnet-4-20250514",
        ));
        requires_model_client(&RemoteModelClient::default());
        requires_model_client(&FakeModelClient::new(vec![], "{}"));
    }

    // ── 3.5: Swapping backends needs no workflow change ────────────
    //
    // `mini_workflow` is defined once (above) and called with `FakeModelClient`
    // at runtime. The compile-time check above proves the same function
    // accepts `LocalModelClient` and `RemoteModelClient` with zero changes.

    // ── 3.3: RemoteModelClient returns not-implemented ─────────────

    #[tokio::test]
    async fn remote_stream_is_not_implemented() {
        let remote = RemoteModelClient::default();
        let result = remote.stream("sys", "prompt").await;
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().to_string(), NOT_IMPLEMENTED);
    }

    #[tokio::test]
    async fn remote_extract_is_not_implemented() {
        #[derive(JsonSchema, Serialize, serde::Deserialize, Debug)]
        struct Dummy;
        let remote = RemoteModelClient::default();
        let result: anyhow::Result<Dummy> = remote.extract("sys", "prompt").await;
        assert!(result.is_err());
        assert_eq!(result.err().unwrap().to_string(), NOT_IMPLEMENTED);
    }

    // ── 3.4: FakeModelClient yields canned data ────────────────────

    #[tokio::test]
    async fn fake_stream_yields_deltas_in_order() {
        let fake = FakeModelClient::new(vec!["alpha".into(), "beta".into(), "gamma".into()], "{}");
        let mut stream = fake.stream("sys", "prompt").await.unwrap();
        let mut collected = Vec::new();
        while let Some(delta) = stream.next().await {
            collected.push(delta.unwrap());
        }
        assert_eq!(collected, vec!["alpha", "beta", "gamma"]);
    }

    #[tokio::test]
    async fn fake_extract_returns_typed_value() {
        #[derive(JsonSchema, Serialize, serde::Deserialize, PartialEq, Debug)]
        struct Data {
            name: String,
            value: i32,
        }

        let fake = FakeModelClient::new(vec![], r#"{"name":"test","value":42}"#);
        let result: Data = fake.extract("sys", "prompt").await.unwrap();
        assert_eq!(
            result,
            Data {
                name: "test".into(),
                value: 42
            }
        );
    }

    #[tokio::test]
    async fn fake_extract_bad_json_errors() {
        #[derive(JsonSchema, Serialize, serde::Deserialize)]
        struct Data {
            name: String,
        }

        let fake = FakeModelClient::new(vec![], "not json at all");
        let result: anyhow::Result<Data> = fake.extract("sys", "prompt").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn fake_stream_empty_deltas() {
        let fake = FakeModelClient::new(vec![], "{}");
        let mut stream = fake.stream("sys", "prompt").await.unwrap();
        assert!(stream.next().await.is_none());
    }

    // ── Provider enum sanity ────────────────────────────────────────

    #[test]
    fn provider_equality() {
        assert_eq!(Provider::OpenAi, Provider::OpenAi);
        assert_ne!(Provider::OpenAi, Provider::Anthropic);
    }

    // ── LocalModelClient construction ──────────────────────────────

    #[test]
    fn local_client_stores_config() {
        let c = LocalModelClient::new(
            Provider::OpenAi,
            "sk-test",
            Some("https://proxy.example.com".into()),
            "gpt-4o",
        );
        assert_eq!(c.provider, Provider::OpenAi);
        assert_eq!(c.api_key, "sk-test");
        assert_eq!(c.base_url.as_deref(), Some("https://proxy.example.com"));
        assert_eq!(c.model, "gpt-4o");
    }

    #[test]
    fn local_client_without_base_url() {
        let c = LocalModelClient::new(Provider::Anthropic, "key", None, "claude");
        assert!(c.base_url.is_none());
    }
}
