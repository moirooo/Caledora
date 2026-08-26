---
name: Backup media rollback
description: Atomic global restore requirements when media spans local stores and remote uploads.
---

When a global restore writes core records and also hydrates media, the rollback boundary includes every newly created media object, not only the page and localStorage records. A client upload can succeed remotely and then fail while recording its local media-library entry, so that helper must compensate its own remote write before returning an error.

**Why:** Browser storage, local media IndexedDB, and server uploads do not share a transaction. Rolling back only the visible records leaves orphaned media and violates the promise that a failed restoration preserves the previous state.

**How to apply:** Validate binary media content before hydration; track every created media identifier/path; delete those only on a failed primary commit; and require confirmed cleanup rather than swallowing HTTP failures.