---
name: Gemini workspace runtime
description: Runtime dependency rule for using the Gemini SDK from the API-server bundle.
---

When a workspace wrapper imports the Gemini SDK, the API service must also declare the SDK as a direct dependency.

**Why:** The API bundler can leave the SDK as an external runtime import; relying only on the wrapper package’s dependency then causes the server to fail at startup with a missing-module error.

**How to apply:** Keep the Gemini workspace client for shared configuration, but retain the direct SDK dependency in the API server whenever that client is imported by an API route.