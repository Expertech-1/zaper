-- ============================================================================
-- Zaper — initial schema (M1)
-- ============================================================================
-- Conventions used throughout:
--
--   * Primary keys are UUIDv4 strings (TEXT). Stable across export/import and
--     safe to generate in Rust without a round-trip to the database.
--   * Timestamps are RFC 3339 / ISO 8601 strings in UTC (TEXT). SQLite has no
--     native date type; storing a lexicographically sortable UTC string keeps
--     ORDER BY correct and round-trips cleanly through chrono and JSON.
--   * Flat lists of short strings (skills, tags) are stored as JSON arrays in a
--     TEXT column. Structured entities (experiences, projects, stories) get real
--     tables with foreign keys. This keeps the schema honest without exploding
--     into join tables for what are really value objects.
--   * Enum-like columns are constrained with CHECK so bad data cannot land even
--     if a future caller skips validation.
--   * Foreign keys use ON DELETE CASCADE for owned children. `PRAGMA
--     foreign_keys = ON` is set per-connection in `db::connect`.
--
-- Secrets are deliberately absent from this schema. API keys live in the OS
-- keyring (see `services::keyring`), never in SQLite.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Settings — a single-row-per-key store for user preferences.
-- Values are JSON-encoded so a key can hold a scalar, an object or a list
-- without a migration every time a preference gains structure.
-- ---------------------------------------------------------------------------
CREATE TABLE settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Profiles — WHO the assistant answers as.
-- Interview-specific facts do NOT belong here (see `interviews`).
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
    id           TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    headline     TEXT,
    summary      TEXT,
    skills       TEXT NOT NULL DEFAULT '[]',
    technologies TEXT NOT NULL DEFAULT '[]',
    achievements TEXT NOT NULL DEFAULT '[]',
    opinions     TEXT NOT NULL DEFAULT '[]',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX idx_profiles_name ON profiles (name);

CREATE TABLE profile_experiences (
    id          TEXT PRIMARY KEY NOT NULL,
    profile_id  TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    company     TEXT NOT NULL,
    role        TEXT NOT NULL,
    description TEXT,
    start_date  TEXT,
    end_date    TEXT,
    position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_profile_experiences_profile ON profile_experiences (profile_id, position);

CREATE TABLE profile_projects (
    id           TEXT PRIMARY KEY NOT NULL,
    profile_id   TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    technologies TEXT NOT NULL DEFAULT '[]',
    url          TEXT,
    position     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_profile_projects_profile ON profile_projects (profile_id, position);

-- STAR stories. Stored as four discrete fields so prompts can weave them into
-- natural prose instead of emitting literal "Situation:/Task:/..." labels.
CREATE TABLE profile_stories (
    id         TEXT PRIMARY KEY NOT NULL,
    profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    situation  TEXT NOT NULL DEFAULT '',
    task       TEXT NOT NULL DEFAULT '',
    action     TEXT NOT NULL DEFAULT '',
    result     TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '[]',
    position   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_profile_stories_profile ON profile_stories (profile_id, position);

-- ---------------------------------------------------------------------------
-- Interviews — WHAT interview is currently happening.
-- Separate from profiles by design (spec §8): interview context is transient.
-- ---------------------------------------------------------------------------
CREATE TABLE interviews (
    id                  TEXT PRIMARY KEY NOT NULL,
    profile_id          TEXT REFERENCES profiles (id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    company             TEXT,
    role                TEXT,
    job_description     TEXT,
    interview_type      TEXT,
    interviewer         TEXT,
    company_research    TEXT,
    custom_instructions TEXT,
    mode                TEXT NOT NULL DEFAULT 'research'
                        CHECK (mode IN ('research', 'job', 'coding')),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX idx_interviews_profile ON interviews (profile_id);
CREATE INDEX idx_interviews_created ON interviews (created_at DESC);

-- ---------------------------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------------------------
CREATE TABLE meetings (
    id         TEXT PRIMARY KEY NOT NULL,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'recording'
               CHECK (status IN ('recording', 'finalizing', 'summarizing', 'completed', 'failed')),
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    summary    TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_meetings_started ON meetings (started_at DESC);

CREATE TABLE meeting_segments (
    id          TEXT PRIMARY KEY NOT NULL,
    meeting_id  TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
    speaker     TEXT,
    source      TEXT NOT NULL DEFAULT 'system'
                CHECK (source IN ('microphone', 'system')),
    text        TEXT NOT NULL,
    started_ms  INTEGER NOT NULL,
    ended_ms    INTEGER,
    created_at  TEXT NOT NULL
);

CREATE INDEX idx_meeting_segments_meeting ON meeting_segments (meeting_id, started_ms);

CREATE TABLE meeting_action_items (
    id          TEXT PRIMARY KEY NOT NULL,
    meeting_id  TEXT NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    owner       TEXT,
    deadline    TEXT,
    completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    created_at  TEXT NOT NULL
);

CREATE INDEX idx_meeting_action_items_meeting ON meeting_action_items (meeting_id);

-- ---------------------------------------------------------------------------
-- Documents & retrieval
-- ---------------------------------------------------------------------------
CREATE TABLE documents (
    id            TEXT PRIMARY KEY NOT NULL,
    scope         TEXT NOT NULL
                  CHECK (scope IN ('global', 'profile', 'interview', 'meeting')),
    profile_id    TEXT REFERENCES profiles (id) ON DELETE CASCADE,
    meeting_id    TEXT REFERENCES meetings (id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    source_path   TEXT,
    stored_path   TEXT NOT NULL,
    mime_type     TEXT,
    byte_size     INTEGER NOT NULL DEFAULT 0,
    checksum      TEXT,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'parsing', 'ready', 'failed')),
    error_message TEXT,
    metadata      TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX idx_documents_scope ON documents (scope);
CREATE INDEX idx_documents_profile ON documents (profile_id);

-- Many-to-many: a document may be attached to several interviews without being
-- re-imported (spec §35 `interview_documents`).
CREATE TABLE interview_documents (
    interview_id TEXT NOT NULL REFERENCES interviews (id) ON DELETE CASCADE,
    document_id  TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    PRIMARY KEY (interview_id, document_id)
);

CREATE INDEX idx_interview_documents_document ON interview_documents (document_id);

CREATE TABLE document_chunks (
    id              TEXT PRIMARY KEY NOT NULL,
    document_id     TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    token_estimate  INTEGER NOT NULL DEFAULT 0,
    embedding       BLOB,
    embedding_model TEXT,
    metadata        TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL,
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document ON document_chunks (document_id, chunk_index);

-- ---------------------------------------------------------------------------
-- Conversations — question/answer history used for short-term memory.
-- ---------------------------------------------------------------------------
CREATE TABLE conversations (
    id           TEXT PRIMARY KEY NOT NULL,
    interview_id TEXT REFERENCES interviews (id) ON DELETE CASCADE,
    profile_id   TEXT REFERENCES profiles (id) ON DELETE SET NULL,
    mode         TEXT NOT NULL DEFAULT 'research'
                 CHECK (mode IN ('research', 'job', 'coding')),
    title        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX idx_conversations_interview ON conversations (interview_id);
CREATE INDEX idx_conversations_created ON conversations (created_at DESC);

CREATE TABLE conversation_messages (
    id              TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content         TEXT NOT NULL,
    metadata        TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL
);

CREATE INDEX idx_conversation_messages_conversation
    ON conversation_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Diagnostics — local only. Never transmitted anywhere (see PRIVACY.md).
-- ---------------------------------------------------------------------------
CREATE TABLE ai_usage (
    id                TEXT PRIMARY KEY NOT NULL,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    operation         TEXT NOT NULL
                      CHECK (operation IN ('chat', 'transcribe', 'vision', 'tts', 'embedding')),
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    latency_ms        INTEGER,
    succeeded         INTEGER NOT NULL DEFAULT 1 CHECK (succeeded IN (0, 1)),
    error_kind        TEXT,
    created_at        TEXT NOT NULL
);

CREATE INDEX idx_ai_usage_created ON ai_usage (created_at DESC);

CREATE TABLE app_events (
    id         TEXT PRIMARY KEY NOT NULL,
    level      TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    event      TEXT NOT NULL,
    detail     TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX idx_app_events_created ON app_events (created_at DESC);
