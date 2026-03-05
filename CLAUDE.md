# <span data-proof="authored" data-by="ai:claude">CLAUDE.md</span>

<span data-proof="authored" data-by="ai:claude">This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.</span>

## <span data-proof="authored" data-by="ai:claude">Repository Purpose</span>

<span data-proof="authored" data-by="ai:claude">This is a</span> **<span data-proof="authored" data-by="ai:claude">documentation-only repository</span>** <span data-proof="authored" data-by="ai:claude">containing a reverse engineering teardown of the</span> [<span data-proof="authored" data-by="ai:claude">claude-mem</span>](https://github.com/thedotmack/claude-mem) <span data-proof="authored" data-by="ai:claude">project (v10.5.2). The teardown follows Kevin Chen's Rewind AI Teardown Methodology.</span>

<span data-proof="authored" data-by="ai:claude">The primary artifact is</span> <span data-proof="authored" data-by="ai:claude">`Claude-Mem-Teardown.md`</span> <span data-proof="authored" data-by="ai:claude">— a comprehensive analysis (~144KB) covering architecture, database schema, hook systems, MCP tools, prompt engineering, and a phase-by-phase clone blueprint for the claude-mem memory compression system.</span>

## <span data-proof="authored" data-by="ai:claude">What claude-mem Is (Context for the Teardown)</span>

<span data-proof="authored" data-by="ai:claude">claude-mem is a Claude Code plugin that persists context across sessions using:</span>

* **<span data-proof="authored" data-by="ai:claude">Lifecycle hooks</span>** <span data-proof="authored" data-by="ai:claude">(SessionStart, UserPromptSubmit, PostToolUse, Stop) that intercept Claude Code events</span>

* <span data-proof="authored" data-by="ai:claude">A</span> **<span data-proof="authored" data-by="ai:claude">secondary Claude agent</span>** <span data-proof="authored" data-by="ai:claude">(via Agent SDK) that observes tool usage and generates structured XML observations</span>

* **<span data-proof="authored" data-by="ai:claude">SQLite</span>** <span data-proof="authored" data-by="ai:claude">(`bun:sqlite`) for storage with FTS5 full-text search</span>

* **<span data-proof="authored" data-by="ai:claude">Chroma</span>** <span data-proof="authored" data-by="ai:claude">vector database for semantic search</span>

* <span data-proof="authored" data-by="ai:claude">An</span> **<span data-proof="authored" data-by="ai:claude">Express/Bun worker service</span>** <span data-proof="authored" data-by="ai:claude">on localhost:37777</span>

* <span data-proof="authored" data-by="ai:claude">An</span> **<span data-proof="authored" data-by="ai:claude">MCP server</span>** <span data-proof="authored" data-by="ai:claude">exposing 7 tools (search, timeline, smart_search, etc.)</span>

* <span data-proof="authored" data-by="ai:claude">A</span> **<span data-proof="authored" data-by="ai:claude">React viewer UI</span>** <span data-proof="authored" data-by="ai:claude">for browsing observations</span>

## <span data-proof="authored" data-by="ai:claude">Working with This Repository</span>

<span data-proof="authored" data-by="ai:claude">There is no build system, test suite, or runnable code. Work here involves reading, editing, and extending the teardown document. The document uses HTML</span> <span data-proof="authored" data-by="ai:claude">`<span data-proof="authored" data-by="ai:claude">`</span> <span data-proof="authored" data-by="ai:claude">tags throughout for provenance tracking.</span>

## <span data-proof="authored" data-by="ai:claude">Teardown Document Structure</span>

<span data-proof="authored" data-by="ai:claude">The document has 38 numbered sections. Key sections for understanding the system:</span>

* **<span data-proof="authored" data-by="ai:claude">Section 2</span>**<span data-proof="authored" data-by="ai:claude">: Architecture diagram (the big picture)</span>

* **<span data-proof="authored" data-by="ai:claude">Sections 7-8</span>**<span data-proof="authored" data-by="ai:claude">: Lifecycle hooks and hook response protocol (the core engine)</span>

* **<span data-proof="authored" data-by="ai:claude">Section 12</span>**<span data-proof="authored" data-by="ai:claude">: Database schema (7 migrations)</span>

* **<span data-proof="authored" data-by="ai:claude">Section 15</span>**<span data-proof="authored" data-by="ai:claude">: Session ID architecture (critical duality between hook session ID and agent session ID)</span>

* **<span data-proof="authored" data-by="ai:claude">Section 19</span>**<span data-proof="authored" data-by="ai:claude">: Prompt engineering for the observer agent</span>

* **<span data-proof="authored" data-by="ai:claude">Section 38</span>**<span data-proof="authored" data-by="ai:claude">: Clone blueprint with phased implementation plan</span>