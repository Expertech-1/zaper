//! Data access layer.
//!
//! Repositories are the *only* place that speaks SQL. They take and return
//! domain types, run multi-step writes inside transactions, and never expose
//! `sqlx` types to callers.

pub mod profiles;
pub mod settings;
