//! Typed domain models shared by repositories, commands and (mirrored) the UI.
//!
//! This layer is pure: no SQL, no HTTP, no Tauri. It owns the vocabulary of the
//! product (modes, answer lengths, profiles, settings) and the validation rules
//! that keep invalid data out of the database. That makes every rule unit
//! testable without a runtime.

pub mod common;
pub mod profile;
pub mod settings;
