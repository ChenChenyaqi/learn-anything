// Typed wrappers around every Tauri command registered in src-tauri.
//
// Split by surface (config / project / agent / site) for navigability; this
// barrel re-exports everything so existing `import ... from '@/lib/commands'`
// call sites keep working unchanged. The Rust↔TS contract for each surface
// lives with its module — components import typed functions instead of
// scattering raw `invoke(...)` strings that can silently drift from the Rust
// command names/signatures.

export * from './config';
export * from './project';
export * from './site';
export * from './agent';
