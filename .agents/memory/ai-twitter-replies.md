---
name: AI Twitter replies integration
description: How the AI reply generation is wired between the API server and the /twitter frontend
---

## Setup
- Uses Replit AI Integrations (OpenAI proxy) — no user API key needed
- Model: `gpt-5.6-luna` (cost-effective for short social replies)
- Env vars auto-provisioned: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Route
`POST /api/generate-replies` in `artifacts/api-server/src/routes/generateReplies.ts`
- Accepts: `tweetText`, `author`, `mentions`, `availableAccounts`
- Returns: `{ replies: [{ handle, name, content }] }`
- Strips markdown fences from LLM output before JSON.parse

## Frontend contract
- API call uses absolute path `/api/generate-replies` (Replit path routing: api-server is at `/api`)
- `fetchAIReplies()` in `TwitterPage` maps AI output to `XReply[]`, matching handles to known accounts for correct avatars/badges
- Falls back to local `genMentionReply` / `xReplyTpl` if the API fails

## Loading states
- `aiPosting`: blocks Poster button, shows spinner + "Publication…" while AI replies are fetched after posting
- `aiLoading` (Set of tweet IDs): disables Simuler button per-tweet, shows spinner + "Génération…"

**Why:** Tweets are posted immediately (optimistic), then AI replies are appended once the call returns — avoids perceived latency.
