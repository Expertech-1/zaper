# PROJECT: Personal AI Interview, Meeting & Research Copilot for Ubuntu and Name is Zaper

# NB: we want to make this software undetectable as much as possible for learning only.

## ROLE

You are a senior staff-level software engineer, desktop systems engineer,
Rust engineer, React/TypeScript architect, AI systems engineer, and UX engineer.
AgentRouterAgentRouter
You are responsible for designing and implementing a production-quality,
Linux-first desktop application called:

    Personal AI Copilot

The application is a private, single-user Ubuntu desktop application.

It is NOT a SaaS product.

It is NOT a public website.

It does NOT require user registration.

It does NOT require subscriptions.

It does NOT require payment processing.

It does NOT require a cloud database.

It MUST NOT use a local LLM.

AI inference will use configurable CLOUD AI PROVIDERS.

The application should provide functionality comparable in spirit to a
modern AI interview/meeting copilot, while being independently implemented
with clean architecture and original UI/UX.

Use the functional requirements below as the specification for our own
implementation.

============================================================

1. # PRIMARY PRODUCT OBJECTIVE

Build a Linux Ubuntu desktop application capable of:

1. Listening to permitted computer/system audio.
2. Listening to the user's microphone when required.
3. Transcribing speech in real time.
4. Detecting questions and meaningful conversational turns.
5. Understanding the current context.
6. Generating concise, natural, context-aware AI responses.
7. Displaying responses in a floating desktop assistant.
8. Optionally reading responses aloud using cloud TTS.
9. Supporting multiple user profiles.
10. Supporting interview-specific context.
11. Supporting uploaded study material and documents.
12. Supporting Research, Job/Behavioral, and Coding modes.
13. Supporting screen capture and visual question analysis.
14. Supporting coding/problem-solving workflows.
15. Supporting meeting transcription.
16. Supporting meeting summaries and action items.
17. Supporting searching and asking questions about previous meetings.
18. Maintaining short-term conversation memory.
19. Providing configurable answer length.
20. Providing configurable response delay.
21. Supporting multiple languages where the selected AI providers support them.
22. Remaining responsive during long-running operations.
23. Being robust against network failures, API failures, malformed responses,
    microphone/system-audio problems, and interrupted sessions.

The product must feel like a native desktop application rather than a website
wrapped in a desktop window.

============================================================ 2. TARGET PLATFORM
============================================================

PRIMARY TARGET:

    Ubuntu Linux desktop.

Prioritize:

    Ubuntu 24.04 LTS and newer compatible Ubuntu releases.

Architecture should be Linux-first.

Do not spend implementation effort on Windows or macOS unless the architecture
can support them naturally without complicating the Linux implementation.

Linux desktop environments may include:

    GNOME
    KDE

Both X11 and Wayland may exist.

IMPORTANT:

Do NOT assume that Windows/macOS screen-capture behavior automatically
translates to Linux.

Any screen-capture, overlay, window-management, or compositor-specific
behavior must be implemented according to what Ubuntu/Linux actually supports.

If a requested capability is compositor-dependent, isolate it behind an
abstraction and document the limitation.

============================================================ 3. TECHNOLOGY STACK
============================================================

MANDATORY STACK:

Desktop framework:
Tauri 2.x

Desktop/backend language:
Rust

Frontend:
React 19+
TypeScript

Build:
Vite

Styling:
Tailwind CSS

State management:
Use a lightweight predictable solution such as Zustand.

Validation:
Zod on the TypeScript side where appropriate.

Database:
SQLite.

Rust SQLite access:
Prefer sqlx or rusqlite based on architectural fit.

AI:
CLOUD AI ONLY.

Do NOT implement a local LLM.

Speech-to-text:
Implement through a provider abstraction.

LLM:
Implement through a provider abstraction.

Vision:
Implement through a provider abstraction.

TTS:
Implement through a provider abstraction.

HTTP:
Rust reqwest and/or frontend HTTP depending on responsibility.

Realtime communication:
WebSocket or streaming HTTP where appropriate.

Testing:
Rust:
cargo test

    Frontend:
        Vitest

    Component/UI:
        React Testing Library where useful

    End-to-end:
        Playwright where practical

Linting:
ESLint

Formatting:
Prettier
rustfmt

Package manager:
pnpm

DO NOT introduce unnecessary technologies.

Do not introduce:
Kubernetes
microservices
Redis
MongoDB
Supabase
PostgreSQL
Docker
Next.js

unless there is a compelling, explicitly documented technical reason.

This is a local desktop application.

============================================================ 4. HIGH-LEVEL ARCHITECTURE
============================================================

Use this architecture:

                    UBUNTU
                       |
             +---------+---------+
             |                   |
             v                   v
       React/TypeScript       Rust/Tauri
             |                   |
             | IPC               |
             +---------+---------+
                       |
                       v
                 Core Services
                       |
        +--------------+----------------+
        |              |                |
        v              v                v
      Audio          Screen           SQLite
        |              |
        v              v
       Cloud AI Providers
        |

+----+----+---------+
| | |
v v v
STT LLM TTS/Vision

ARCHITECTURAL PRINCIPLE:

React is responsible for presentation and user interaction.

Rust is responsible for: - OS integration - audio capture - microphone access - screen capture - global shortcuts - native windows - tray - persistent local state where appropriate - secure native operations - process lifecycle - filesystem operations requiring native access

Cloud services are responsible for: - speech recognition - LLM inference - vision inference - text-to-speech

Do not leak Linux-specific implementation details into React.

React should call well-defined Tauri commands and listen to well-defined
Tauri events.

============================================================ 5. CORE ARCHITECTURAL PRINCIPLES
============================================================

Follow these principles throughout the codebase:

1. Strong separation of concerns.

2. No giant files.

3. No giant components.

4. No giant Rust modules.

5. No business logic hidden inside UI components.

6. No provider-specific AI logic scattered throughout the application.

7. All external providers must be accessed through interfaces/adapters.

8. All long-running operations must support cancellation where practical.

9. All async operations must have explicit loading/error/success states.

10. Never block the UI thread.

11. Never freeze the application while audio or AI processing occurs.

12. Avoid global mutable state unless explicitly justified.

13. Prefer typed domain models.

14. Validate data at boundaries.

15. Never trust AI-generated JSON without schema validation.

16. Never assume an AI response is valid.

17. Never silently swallow errors.

18. Log technical diagnostics without logging sensitive user content by default.

19. Sensitive data must remain local unless it is explicitly required for
    an AI operation.

20. Keep the architecture extensible for additional AI providers.

============================================================ 6. APPLICATION MODES
============================================================

The application must support these primary modes:

A. RESEARCH MODE

Purpose:
Answer general knowledge and research questions.

Behavior: - Match answer depth to the question. - Do not over-explain simple questions. - Provide detailed explanations when explicitly requested. - Prefer concise, conversational answers for spoken interactions.

B. JOB / BEHAVIORAL MODE

Purpose:
Answer job interview questions using the active profile and interview
context.

Behavior: - Use real user experience from the active profile. - Prefer relevant real examples. - Behavioral answers should naturally follow STAR:
Situation
Task
Action
Result

    IMPORTANT:
    Do not literally say:
        "Situation:"
        "Task:"
        "Action:"
        "Result:"

    unless the user explicitly requests structured STAR output.

    Never fabricate:
        employers
        projects
        metrics
        responsibilities
        technologies
        achievements

    If the profile does not contain enough information, the AI must state that
    it lacks sufficient profile information rather than inventing details.

C. CODING MODE

Purpose:
Handle technical interviews and coding questions.

Classify coding questions into:

    1. Behavioral
    2. Conceptual
    3. Implementation

Behavioral:
Use relevant real experience.

Conceptual:
Explain concepts naturally and clearly.

Implementation:
Provide: - approach - reasoning - implementation - complexity - edge cases

Use the selected programming language when known.

If no language is specified, infer carefully from context or ask when necessary.

============================================================ 7. PROFILE SYSTEM
============================================================

Profiles represent WHO the assistant is answering as.

Support multiple profiles.

Example:

    AI Engineer
    Software Engineer
    Frontend Engineer
    AI Trainer
    Custom

Each profile may contain:

    id
    name
    summary
    skills
    technologies
    experience
    education
    projects
    achievements
    certifications
    opinions
    preferences
    interview stories
    resume
    portfolio information

Create strongly typed domain models.

Example:

interface Profile {
id: string;
name: string;
summary?: string;
skills: string[];
technologies: string[];
experience: Experience[];
projects: Project[];
achievements: Achievement[];
stories: STARStory[];
opinions: Opinion[];
createdAt: string;
updatedAt: string;
}

Allow:
create
edit
duplicate
delete
activate

Only one profile is active at a time unless future architecture explicitly
supports multi-profile sessions.

============================================================ 8. INTERVIEW CONTEXT
============================================================

Separate:

    PROFILE

from:

    THIS INTERVIEW

A profile answers:

    "Who is the candidate?"

An interview context answers:

    "What interview is currently happening?"

Interview context may include:

    company
    role
    job description
    interview type
    interviewer information
    company research
    study materials
    custom instructions
    uploaded documents

This distinction is mandatory.

Do not permanently store interview-specific information inside the user's
general profile unless the user explicitly requests it.

============================================================ 9. DOCUMENT MANAGEMENT
============================================================

Support local document import.

Initial formats:

    PDF
    TXT
    Markdown
    DOCX where practical

Documents may belong to:

    Global knowledge
    Profile
    Specific interview
    Meeting

Document pipeline:

    File
      |
      v
    Parse
      |
      v
    Normalize text
      |
      v
    Chunk
      |
      v
    Generate embeddings if supported
      |
      v
    Store locally
      |
      v
    Retrieve relevant chunks during AI requests

The retrieval layer must be abstracted.

Do not send an entire document to the LLM if only a small portion is relevant.

Use retrieval to reduce:
token usage
latency
hallucination
irrelevant context

============================================================ 10. LOCAL DATA STORAGE
============================================================

Use SQLite.

Suggested tables:

    profiles
    profile_experiences
    profile_projects
    profile_stories
    interviews
    interview_documents
    documents
    document_chunks
    conversations
    conversation_messages
    meetings
    meeting_transcripts
    meeting_segments
    meeting_action_items
    settings
    ai_usage
    app_events

Use migrations.

Database schema must be versioned.

Do not store secrets in SQLite in plaintext.

Sensitive secrets should use the operating system's secure credential
storage/keyring where possible.

============================================================ 11. AI PROVIDER ABSTRACTION
============================================================

Do not hard-code one AI provider into the domain layer.

Create interfaces.

Example:

interface LLMProvider {
streamAnswer(request: LLMRequest): AsyncIterable<LLMToken>;
}

interface SpeechToTextProvider {
transcribeStream(input: AudioStream): AsyncIterable<TranscriptEvent>;
}

interface VisionProvider {
analyzeImage(request: VisionRequest): Promise<VisionResult>;
}

interface TTSProvider {
synthesize(text: string): AsyncIterable<AudioChunk>;
}

Create provider adapters.

The application should be able to switch providers through configuration.

The domain layer must not depend directly on provider SDK types.

============================================================ 12. AI REQUEST PIPELINE
============================================================

Every AI request should conceptually follow:

    INPUT
      |
      v
    CLASSIFICATION
      |
      v
    CONTEXT RETRIEVAL
      |
      v
    PROMPT CONSTRUCTION
      |
      v
    AI PROVIDER
      |
      v
    VALIDATION
      |
      v
    RESPONSE TRANSFORMATION
      |
      v
    UI / TTS

The context engine should determine:

    active profile
    active interview
    current mode
    recent conversation
    relevant documents
    relevant previous answers
    current question
    user settings

============================================================ 13. REAL-TIME AUDIO PIPELINE
============================================================

This is a core feature.

The application must support permitted capture of:

    computer/system audio
    microphone audio

Use Linux audio infrastructure appropriately.

Do not assume a specific desktop audio stack without detection/configuration.

The architecture should support PipeWire primarily.

The pipeline:

    Audio Source
       |
       v
    Rust Audio Capture
       |
       v
    Audio Buffer
       |
       v
    Streaming STT
       |
       v
    Transcript Events
       |
       v
    Question/Turn Detector
       |
       v
    Context Engine
       |
       v
    LLM
       |
       v
    Streaming Answer
       |
       +----------------+
       |                |
       v                v
    Floating UI        TTS
                         |
                         v
                       Audio Output

Audio processing must be asynchronous.

Use bounded buffers.

Avoid unbounded memory growth.

Handle:
device unavailable
permission denied
device disconnected
stream interrupted
API unavailable
network timeout
malformed audio
STT failure

============================================================ 14. SPEECH-TO-TEXT
============================================================

Implement streaming transcription.

The UI should show partial transcription where supported.

Transcript states:

    partial
    finalized

Do not trigger an AI answer for every partial transcript.

Use a turn/question detection mechanism.

Example:

    partial transcript
          |
          v
    continue listening
          |
          v
    semantic completion + silence
          |
          v
    finalize turn
          |
          v
    generate answer

============================================================ 15. QUESTION DETECTION
============================================================

Build a dedicated QuestionDetector.

It should consider:

    punctuation
    semantic completeness
    silence
    interrogative language
    conversation context
    configured wait delay

Do not rely exclusively on punctuation because speech transcripts may lack
punctuation.

Allow a configurable:

    Wait before answering

value.

The system should support a reasonable range, including approximately 0–9
seconds.

Do not automatically answer if the transcript is clearly incomplete.

============================================================ 16. CONVERSATION MEMORY
============================================================

Implement short-term conversation memory.

Maintain recent exchanges:

    question
    answer
    follow-up question
    answer

Use memory to answer follow-ups coherently.

Do not blindly send the entire transcript to every LLM request.

Implement:
recent-message window
optional summarization
relevance selection

Long conversations must not cause unbounded token growth.

============================================================ 17. ANSWER LENGTH
============================================================

Support:

    Short
    Medium
    Detailed

The setting must influence both:

    LLM generation
    TTS output

Example:

SHORT:
1–3 concise sentences.

MEDIUM:
conversational answer with useful detail.

DETAILED:
deeper explanation, examples, tradeoffs, etc.

Do not treat answer length as merely a UI label.

It must be represented in the AI generation configuration.

============================================================ 18. TTS / EARPIECE MODE
============================================================

Support optional spoken answers.

Pipeline:

    LLM token stream
       |
       v
    Sentence buffer
       |
       v
    TTS
       |
       v
    Audio output

Do not wait for the entire answer before starting TTS.

Start speaking when a usable sentence or phrase is available.

Settings:

    enable/disable
    voice
    speed
    volume
    answer length
    wait delay

If TTS fails, the text answer must still appear.

============================================================ 19. FLOATING ASSISTANT WINDOW
============================================================

Create a dedicated assistant window.

Properties:

    always-on-top
    frameless
    draggable
    resizable
    minimal
    keyboard accessible

It should display:

    current mode
    detected question
    answer
    AI generation state
    error state

Actions:

    regenerate
    shorten
    expand
    copy
    speak
    stop speaking
    hide

The floating assistant must never block the main application.

============================================================ 20. MAIN APPLICATION UI
============================================================

Main sections:

    Dashboard
    Interview
    Profiles
    Documents
    Meetings
    History
    Settings

The UI must be clean, modern, professional, and desktop-oriented.

Do not make it look like a generic admin dashboard.

Use:
clear hierarchy
compact desktop layouts
keyboard-friendly interactions
accessible controls
meaningful empty states
useful loading states
useful error states

Support:
dark mode
light mode

Use Tailwind CSS.

Do not introduce CSS frameworks other than Tailwind.

============================================================ 21. GLOBAL KEYBOARD SHORTCUTS
============================================================

Implement configurable global shortcuts.

Default examples:

    Ctrl + Space
        Show/hide assistant

    Ctrl + Shift + S
        Read screen

    Ctrl + Shift + M
        Toggle meeting mode

    Ctrl + Shift + L
        Toggle listening

    Ctrl + Shift + R
        Regenerate answer

Do not hard-code these in a way that prevents future customization.

Shortcut registration must be handled by Rust/Tauri.

Handle shortcut conflicts gracefully.

============================================================ 22. SCREEN READING
============================================================

Implement a one-shot screen reading workflow.

Flow:

    Global shortcut
       |
       v
    Capture selected/full screen
       |
       v
    Vision provider
       |
       v
    Extract question/problem
       |
       v
    Current mode
       |
       v
    Context engine
       |
       v
    LLM
       |
       v
    Answer

The system should support:
full screen
selected region

Prefer selected region when practical.

Do not persist screenshots by default.

Delete temporary image data after processing unless explicitly saved.

IMPORTANT:

Linux screen capture varies between:
Wayland
X11
GNOME
KDE

Implement an abstraction.

Detect unsupported capabilities.

Provide clear user-facing errors.

Do not pretend unsupported functionality works.

============================================================ 23. CODING SCREEN ANALYSIS
============================================================

When the current mode is Coding and the screen contains a programming
problem, the AI should attempt to extract:

    problem statement
    constraints
    examples
    input/output requirements
    programming language

Then generate:

    interpretation
    approach
    algorithm
    code
    complexity
    edge cases

If the screenshot is ambiguous, say what is unclear.

Never fabricate missing constraints.

============================================================ 24. MEETING MODE
============================================================

Meeting mode is separate from interview mode.

When started:

    capture system audio
    capture microphone audio where permitted
    transcribe continuously
    record transcript segments
    associate timestamps

During meeting:

    live transcript

After meeting:

    summary
    decisions
    action items
    important topics
    unresolved questions

Store meeting data locally.

Do not upload old meeting transcripts automatically.

Only send relevant transcript sections to cloud AI.

============================================================ 25. MEETING SEARCH
============================================================

Allow users to search saved meetings.

Examples:

    "What did we decide about deployment?"

    "Who was responsible for the API?"

    "What deadline did we agree on?"

Pipeline:

    query
      |
      v
    meeting retrieval
      |
      v
    relevant transcript segments
      |
      v
    LLM
      |
      v
    answer

Provide source references/timestamps when possible.

============================================================ 26. PRIVACY
============================================================

This is a personal application.

Privacy is a first-class requirement.

Default principles:

    local-first storage
    no analytics
    no telemetry
    no advertising
    no third-party tracking
    no background uploads
    no automatic cloud synchronization

Audio should not be permanently stored unless the user explicitly enables
recording/storage.

Screenshots should not be permanently stored unless explicitly requested.

Documents remain local.

Only the minimum necessary context should be sent to cloud AI providers.

Provide a clear "what is sent to cloud AI" explanation in settings.

============================================================ 27. API KEY SECURITY
============================================================

Do not store AI API keys in:

    source code
    React environment variables bundled into production
    plaintext configuration files

Use OS credential storage/keyring when possible.

If a private AI gateway is used, authenticate securely.

Create a provider configuration UI.

Support:

    provider
    model
    API key/credential
    endpoint
    timeout
    temperature where supported
    maximum output tokens

Never expose secrets through logs.

============================================================ 28. NETWORK RESILIENCE
============================================================

AI services require internet connectivity.

Handle:

    no network
    DNS failure
    timeout
    rate limit
    provider outage
    invalid API key
    malformed provider response
    streaming disconnect

The UI should clearly distinguish:

    network error
    provider error
    application error
    user cancellation

Allow retry.

Do not retry indefinitely.

Use bounded exponential backoff where appropriate.

============================================================ 29. ERROR HANDLING
============================================================

Every feature must have:

    loading
    success
    empty
    error
    cancelled

states where appropriate.

Errors must be human-readable.

Example:

BAD:

    Error: ECONNRESET

GOOD:

    "The AI service connection was interrupted.
     Your answer was not completed. Retry?"

Technical details may appear in diagnostic logs.

============================================================ 30. LOGGING
============================================================

Implement structured application logging.

Log:

    lifecycle events
    errors
    provider failures
    performance metrics
    audio-device failures
    database failures

Do NOT log by default:

    raw microphone audio
    full transcripts
    CV contents
    API keys
    sensitive documents
    complete AI prompts

Provide configurable diagnostic logging for development.

============================================================ 31. PERFORMANCE
============================================================

The application must remain responsive while:

    transcribing
    generating AI responses
    performing RAG
    processing screenshots
    synthesizing speech
    processing meetings

Use asynchronous execution.

Measure:

    STT latency
    time to question detection
    LLM time-to-first-token
    total generation latency
    TTS startup latency
    screen-analysis latency

Do not optimize blindly.

Create instrumentation that allows bottlenecks to be identified.

============================================================ 32. STATE MACHINE
============================================================

Do not model assistant lifecycle using many unrelated booleans.

Use explicit state machines.

Example:

    Idle
      |
      v
    Listening
      |
      v
    Transcribing
      |
      v
    QuestionDetected
      |
      v
    RetrievingContext
      |
      v
    Generating
      |
      v
    AnswerReady
      |
      v
    Speaking
      |
      v
    Idle

Possible error/cancel transitions must exist.

Meeting state machine:

    Idle
      |
      v
    Starting
      |
      v
    Recording
      |
      v
    Finalizing
      |
      v
    Summarizing
      |
      v
    Completed

Make transitions explicit and testable.

============================================================ 33. SECURITY BOUNDARIES
============================================================

Treat all external input as untrusted.

Validate:

    file paths
    imported files
    AI responses
    provider JSON
    database records
    IPC payloads
    configuration values

Prevent:

    path traversal
    arbitrary file access
    unsafe shell execution
    command injection
    secret leakage
    untrusted HTML rendering

Never execute AI-generated shell commands automatically.

Never execute AI-generated code automatically.

============================================================ 34. RUST / TAURI SECURITY
============================================================

Use Tauri's capability/permission system properly.

Grant only the permissions required.

Do not expose arbitrary filesystem access to the frontend.

Do not expose arbitrary shell execution.

Create narrowly scoped commands.

Example:

GOOD:

    get_profile(id)

BAD:

    execute_arbitrary_command(command)

The Rust API exposed to React must be intentional and typed.

============================================================ 35. DATABASE DESIGN
============================================================

Create proper migrations.

Example:

profiles
id
name
summary
created_at
updated_at

experiences
id
profile_id
company
role
description
start_date
end_date

projects
id
profile_id
name
description
technologies

stories
id
profile_id
title
situation
task
action
result

interviews
id
profile_id
company
role
mode
created_at

documents
id
scope
profile_id
interview_id
name
path
metadata

document_chunks
id
document_id
content
embedding_metadata

conversations
id
interview_id
mode
created_at

conversation_messages
id
conversation_id
role
content
timestamp

meetings
id
title
started_at
ended_at
summary

meeting_segments
id
meeting_id
speaker
text
timestamp

meeting_action_items
id
meeting_id
description
owner
deadline
completed

settings
key
value

Use foreign keys.

Use indexes where needed.

Use transactions for multi-step operations.

============================================================ 36. FILE MANAGEMENT
============================================================

Store application data under appropriate Linux user application directories.

Do not store application files randomly in the project directory.

Use platform-aware paths through Tauri/Rust.

Maintain separate directories for:

    database
    imported documents
    temporary files
    logs
    cached data

Temporary files must have cleanup policies.

============================================================ 37. FRONTEND ARCHITECTURE
============================================================

Organize React by feature.

Example:

src/
app/
components/
features/
assistant/
interview/
meetings/
profiles/
documents/
settings/
screen-reader/
hooks/
services/
stores/
types/
utils/

Avoid:

    giant App.tsx
    giant global store
    giant API client
    duplicated business logic

Use reusable components.

Use TypeScript strict mode.

Avoid any.

Do not use JavaScript files for application logic.

============================================================ 38. IPC CONTRACT
============================================================

Define typed contracts between React and Rust.

Example commands:

    start_audio_capture
    stop_audio_capture
    get_audio_devices
    capture_screen
    capture_region
    start_meeting
    stop_meeting
    save_profile
    load_profile
    import_document
    search_documents
    get_settings
    update_settings

Events:

    audio_started
    audio_stopped
    transcript_partial
    transcript_final
    question_detected
    answer_started
    answer_token
    answer_completed
    tts_started
    tts_stopped
    meeting_transcript
    meeting_completed
    system_error

Do not create uncontrolled event names throughout the codebase.

Centralize the IPC contract.

============================================================ 39. STREAMING AI
============================================================

LLM responses should stream where the provider supports it.

The UI should render tokens progressively.

Example:

    answer_started

    answer_token:
        "One"

    answer_token:
        " example"

    answer_token:
        " from"

    answer_token:
        " my"

    ...

    answer_completed

The UI must handle:

    cancellation
    provider disconnect
    partial answer
    retry
    regeneration

============================================================ 40. PROMPT ENGINEERING
============================================================

Prompts must be versioned and centralized.

Do not scatter giant prompt strings throughout components.

Create:

    prompts/
        research.ts
        behavioral.ts
        coding.ts
        meeting.ts
        screen.ts
        system.ts

The prompt builder must receive structured context.

Example:

    buildInterviewPrompt({
        profile,
        interview,
        mode,
        question,
        conversation,
        retrievedDocuments,
        answerLength
    })

The system prompt must explicitly prohibit fabrication.

============================================================ 41. AI OUTPUT VALIDATION
============================================================

Whenever structured AI output is required, use schemas.

Example:

    z.object({
        questionType: z.enum([
            "behavioral",
            "conceptual",
            "implementation",
            "general"
        ]),
        confidence: z.number(),
        reasoning: z.string().optional()
    })

Never trust raw AI JSON.

If validation fails:

    retry once with correction instructions

If it still fails:

    degrade gracefully to text response.

============================================================ 42. USER SETTINGS
============================================================

Settings must include at least:

    active profile
    default mode
    answer length
    response delay
    TTS enabled
    TTS voice
    TTS speed
    microphone device
    system audio source
    preferred AI provider
    preferred models
    global shortcuts
    theme
    language
    diagnostic logging

Settings should persist locally.

============================================================ 43. ONBOARDING
============================================================

First launch should guide the user through:

    1. Welcome
    2. AI provider configuration
    3. API credential setup
    4. Microphone permission/device
    5. System audio availability
    6. Screen capture capability
    7. Create/import profile
    8. Optional resume import
    9. Test AI connection
    10. Test speech-to-text
    11. Test TTS

The user should be able to skip optional steps and configure them later.

============================================================ 44. OFFLINE BEHAVIOR
============================================================

The application should still open without internet.

Offline capabilities:

    profiles
    documents
    database
    settings
    history
    meeting history
    UI

Cloud-dependent features should clearly show:

    "Internet connection required."

Do not crash.

============================================================ 45. TESTING STRATEGY
============================================================

Write tests throughout development.

Unit tests:

    question classification
    context selection
    prompt construction
    answer-length rules
    profile retrieval
    state transitions
    settings validation
    database operations

Integration tests:

    AI provider adapters
    SQLite repositories
    IPC contracts
    streaming events

UI tests:

    profile creation
    interview creation
    mode switching
    assistant window
    settings
    document import

Rust tests:

    state machines
    audio lifecycle logic
    command validation
    filesystem operations

End-to-end tests where feasible.

============================================================ 46. TESTABILITY
============================================================

Do not tightly couple the AI layer to real external APIs.

Create mock providers:

    MockLLMProvider
    MockSTTProvider
    MockVisionProvider
    MockTTSProvider

This allows the entire application to be tested without spending API credits.

============================================================ 47. OBSERVABILITY / PERFORMANCE
============================================================

Create internal metrics for development:

    audio_capture_latency
    transcript_latency
    question_detection_latency
    retrieval_latency
    llm_first_token_latency
    llm_total_latency
    tts_start_latency
    screen_analysis_latency

Do not send these metrics anywhere remotely by default.

============================================================ 48. PACKAGING
============================================================

The final application must be distributable as a Linux desktop application.

Provide:

    .deb

and, where practical:

    AppImage

The project must contain reproducible build instructions.

Example:

    pnpm install
    pnpm tauri dev

Production:

    pnpm tauri build

Document all Ubuntu system dependencies.

============================================================ 49. DEVELOPMENT EXPERIENCE
============================================================

Provide:

    README.md
    CONTRIBUTING.md
    ARCHITECTURE.md
    DEVELOPMENT.md
    SECURITY.md
    PRIVACY.md

README must include:

    prerequisites
    Ubuntu setup
    Rust setup
    Node setup
    pnpm setup
    development commands
    AI provider configuration
    audio setup
    build instructions
    troubleshooting

============================================================ 50. DOCUMENTATION
============================================================

Create an architecture document explaining:

    frontend
    Rust core
    IPC
    audio pipeline
    AI pipeline
    screen pipeline
    TTS pipeline
    meeting pipeline
    SQLite
    provider abstractions
    security model
    privacy model

Create diagrams using Mermaid where useful.

============================================================ 51. DEVELOPMENT WORKFLOW
============================================================

Do NOT attempt to build the entire application in one enormous change.

Work incrementally.

PHASE 0:
Analyze requirements.
Inspect repository.
Identify existing code.
Produce implementation plan.

PHASE 1:
Initialize Tauri + React + TypeScript.
Establish Rust/React IPC.

PHASE 2:
Implement SQLite and profiles.

PHASE 3:
Implement document import and retrieval.

PHASE 4:
Implement AI provider abstraction and basic AI responses.

PHASE 5:
Implement audio capture and streaming STT.

PHASE 6:
Implement question detection and interview state machine.

PHASE 7:
Implement streaming LLM answers and floating assistant.

PHASE 8:
Implement TTS.

PHASE 9:
Implement screen capture and vision.

PHASE 10:
Implement meeting mode.

PHASE 11:
Implement meeting search and Q&A.

PHASE 12:
Harden security, performance, error handling, packaging and testing.

At the end of each phase:

    run tests
    run type checking
    run linting
    run formatting
    verify build
    update documentation

Do not proceed while the project is knowingly broken unless the issue is
explicitly documented and isolated.

============================================================ 52. IMPORTANT AGENT BEHAVIOR
============================================================

Before modifying code:

    inspect the repository.

Do not overwrite existing working functionality blindly.

If a file already exists:

    understand it first.

If architecture conflicts with the requirements:

    explain the conflict and refactor carefully.

Do not create duplicate implementations.

Do not add dependencies without justification.

Do not generate placeholder implementations for core functionality and then
pretend the feature is complete.

Use TODO comments only for genuinely blocked external/platform functionality.

============================================================ 53. IMPLEMENTATION PRIORITY
============================================================

Priority order:

P0:
application boots
Tauri/React/Rust communication
profiles
settings
SQLite

P1:
AI provider abstraction
cloud LLM
streaming answers
interview modes
context engine

P2:
system audio
microphone
streaming transcription
question detection

P3:
floating assistant
global shortcuts
TTS

P4:
document RAG
screen reading
vision

P5:
meeting mode
summaries
action items
meeting search
meeting Q&A

P6:
advanced performance
polish
packaging
accessibility
diagnostics

============================================================ 54. ACCEPTANCE CRITERIA
============================================================

The application is considered functionally complete when a user can:

1. Install the application on Ubuntu.

2. Launch it without an internet connection.

3. Configure a cloud AI provider.

4. Create a profile.

5. Import a resume.

6. Create an interview session.

7. Select:
   Research
   Job
   Coding

8. Import interview-specific documents.

9. Start listening.

10. Receive real-time transcription.

11. Detect a completed question.

12. Retrieve relevant profile/context information.

13. Generate a streaming AI response.

14. Display the answer in the floating assistant.

15. Optionally speak the answer through TTS.

16. Adjust answer length.

17. Adjust response delay.

18. Use global keyboard shortcuts.

19. Capture a selected screen region.

20. Send it to a vision model.

21. Generate an answer from the screen content.

22. Start meeting mode.

23. Produce a live meeting transcript.

24. End the meeting.

25. Generate summary and action items.

26. Search previous meetings.

27. Ask questions about previous meetings.

28. Survive provider/network errors gracefully.

29. Persist profiles, documents, settings, conversations and meetings locally.

30. Build successfully into a Linux distributable.

============================================================ 55. NON-FUNCTIONAL ACCEPTANCE CRITERIA
============================================================

The application must:

    remain responsive during AI operations
    avoid memory leaks
    avoid unbounded transcript growth
    avoid leaking secrets
    avoid logging sensitive content
    use strict TypeScript
    use idiomatic Rust
    have meaningful automated tests
    have clean module boundaries
    use typed IPC
    use explicit state machines
    use provider abstractions
    have clear error states
    have reproducible builds
    have documented Linux limitations

============================================================ 56. UI QUALITY BAR
============================================================

The UI should feel like a premium professional desktop application.

Characteristics:

    minimal
    fast
    information-dense without clutter
    keyboard-first
    accessible
    responsive
    polished

Avoid:

    generic SaaS dashboard styling
    unnecessary gradients
    excessive animations
    huge empty spaces
    excessive cards
    meaningless decorative elements

The assistant window should prioritize:

    readability
    low distraction
    rapid scanning

============================================================ 57. PRIVACY AND ETHICAL USE
============================================================

This is a private productivity, learning, accessibility and interview-practice
application for site like mercor, micro1 and others so as make this software undetectable.

If Linux compositor behavior makes a requested visual behavior impossible,
state the limitation and implement the safest supported alternative.

============================================================ 58. FINAL IMPLEMENTATION STANDARD
============================================================

Do not optimize for:

    "code that works once."

Optimize for:

    maintainability
    reliability
    observability
    security
    testability
    low latency
    clean architecture
    extensibility

Every major subsystem must have:

    clear responsibility
    typed interface
    error handling
    tests
    documentation

============================================================ 59. FIRST TASK FOR THE AI CODING AGENT
============================================================

DO NOT immediately start writing the complete application.

First:

1. Inspect the repository.

2. Determine whether a project already exists.

3. Analyze existing files.

4. Produce a concise architecture report.

5. Produce a dependency plan.

6. Produce the proposed directory structure.

7. Produce the SQLite schema.

8. Produce the Rust ↔ React IPC contract.

9. Produce the application state machines.

10. Produce the AI provider abstraction.

11. Produce the implementation roadmap divided into small milestones.

12. Identify Linux-specific risks:
    PipeWire
    Wayland
    X11
    screen capture
    global shortcuts
    audio routing
    Tauri permissions

13. Identify anything in this specification that cannot be guaranteed on
    Ubuntu without additional platform testing.

Then WAIT for confirmation before implementing Phase 1.

============================================================ 60. GOLDEN RULE
============================================================

When making implementation decisions, always ask:

    "Does this make the personal Ubuntu desktop application more reliable,
     maintainable, private, responsive and extensible?"

If yes:
implement it.

If no:
reconsider it.

The goal is not merely to produce a visual clone.

The goal is to engineer a complete, robust, Linux-native personal AI copilot
with clean boundaries between:

    Desktop OS
    Rust
    React
    Local storage
    AI orchestration
    Cloud AI providers
    Speech
    Vision
    TTS
    Meetings
    Documents
    User profiles

Build it like a serious production desktop application.
