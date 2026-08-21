//! IPC command modules.
//!
//! Each feature owns a module here. Command payloads and return types are
//! mirrored on the frontend in `src/types/ipc.ts` — keep them in sync.
//!
//! House rules:
//!
//! * Commands are thin. Validation lives in `domain`, persistence in `repo`,
//!   OS integration in `services`.
//! * Commands return [`crate::error::CommandResult`], so every failure crosses
//!   the boundary as a typed `IpcError` rather than a bare string.
//! * No command takes a table name, SQL fragment, shell string or unrestricted
//!   path.

pub mod app;
pub mod credentials;
pub mod profiles;
pub mod settings;
