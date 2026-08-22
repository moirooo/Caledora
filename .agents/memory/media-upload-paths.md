---
name: Media upload paths
description: Runtime path handling for files written by the standalone API workflow.
---

The API workflow may start with its package directory as the current working directory, so upload and static-media paths must resolve from the server module location rather than from process.cwd().

**Why:** Resolving from the current directory created an unintended nested artifacts path during the first runtime upload test.

**How to apply:** Keep server-side media roots anchored to the API module/runtime directory and verify both the stored file and its served URL after path changes.