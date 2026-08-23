import { Router, type Request } from "express";
import { gemini, geminiUsesDirectKey } from "@workspace/integrations-gemini-ai";

const router = Router();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 18;
const windows = new Map<string, { startedAt: number; requests: number }>();

type Account = {
  id: string;
  username: string;
  displayName: string;
  accountType?: string;
  category?: string;
  personality?: string;
  relations?: Array<{ profileId: string; type: string }>;
};

const text = (value: unknown, size: number) => typeof value === "string" ? value.trim().slice(0, size) : "";

function asAccount(value: unknown): Account | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = text(item.id, 90);
  const username = text(item.username, 50).replace(/^@/, "");
  const displayName = text(item.displayName, 100);
  if (!id || !displayName || !/^[a-z0-9._]{1,50}$/i.test(username)) return null;
  const relations = Array.isArray(item.relations)
    ? item.relations.flatMap(relation => {
      if (!relation || typeof relation !== "object") return [];
      const value = relation as Record<string, unknown>;
      const profileId = text(value.profileId, 90);
      const type = text(value.type, 40);
      return profileId && type ? [{ profileId, type }] : [];
    }).slice(0, 60)
    : [];
  return {
    id,
    username,
    displayName,
    accountType: text(item.accountType, 60) || undefined,
    category: text(item.category, 120) || undefined,
    personality: text(item.personality, 40) || undefined,
    relations,
  };
}

function rateLimit(req: Request) {
  const key = req.ip || "anonymous";
  const now = Date.now();
  const current = windows.get(key);
  const window = !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, requests: 0 } : current;
  if (window.requests >= MAX_REQUESTS) return false;
  window.requests += 1;
  windows.set(key, window);
  return true;
}

function requestOriginIsAllowed(req: Request) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get("host");
  } catch {
    return false;
  }
}

function localComment(account: Account, author: Account) {
  const relation = author.relations?.find(item => item.profileId === account.id)?.type;
  if (relation === "rival") return "On vous attend sur le terrain 👀";
  if (relation === "coéquipier") return "Toujours ensemble, quelle équipe 💪";
  if (relation === "conjoint(e)") return "Tellement fière de toi ❤️";
  if (account.accountType === "club sportif") return "Toute la famille est derrière vous 💙";
  return account.personality === "provocateur" ? "Ça parle beaucoup, on regarde 🔥" : "Magnifique énergie ✨";
}

function cleanGeneratedText(value: unknown) {
  const cleaned = text(value, 220)
    .replace(/^["'«»\s]+|["'«»\s]+$/g, "")
    .replace(/^(commentaire|user|utilisateur)\s*:\s*/iu, "")
    .replace(/#[\p{L}\d_]+/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.split(/\s+/u).slice(0, 12).join(" ");
}

const systemPrompt = `Tu es un expert des réseaux sociaux qui simule des commentaires Instagram réels, vivants et naturels en français dans l'univers fictif de Caledora.

Règles strictes :
- Chaque commentaire fait 1 à 12 mots maximum.
- Langage naturel, parlé, spontané ; ponctuation légère et émojis bien dosés.
- Zéro hashtag, aucun préfixe comme « Commentaire : » ou « User : ».
- Les comptes mentionnés dans la légende commentent impérativement en premier, dans l'ordre reçu, avec une réaction cohérente avec leur lien avec l'auteur.
- Les relations du compte (coéquipier, rival, club, proche, coach, famille, sponsor) réagissent selon leur dynamique.
- Le contexte libre peut demander une atmosphère ou un compte précis : respecte-le.
- Complète avec les comptes disponibles les plus pertinents : stans @[Joueur]Era, agrégateurs @[Club]Zone, insiders, médias ou supporters. N'invente jamais de compte.
- Retourne au moins 4 commentaires lorsque suffisamment de comptes sont disponibles.

Réponds uniquement avec ce JSON strict, sans markdown :
{"comments":[{"user":"pseudo_sans_arobase","text":"commentaire"}]}`;

router.post("/ai/comments", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const author = asAccount(body.author);
  const post = body.post && typeof body.post === "object" ? body.post as Record<string, unknown> : {};
  const caption = text(post.caption, 1200);
  const context = text(post.context, 700);
  const location = text(post.location, 120);
  const category = text(post.category, 120);
  const candidates = (Array.isArray(body.availableAccounts) ? body.availableAccounts : Array.isArray(body.candidates) ? body.candidates : [])
    .map(asAccount)
    .filter((account): account is Account => Boolean(account))
    .slice(0, 220);
  const mentions = Array.isArray(body.mentions) ? body.mentions.map(textValue => text(textValue, 90)).filter(Boolean) : [];
  const contextRequests = Array.isArray(body.contextRequests) ? body.contextRequests.map(textValue => text(textValue, 90)).filter(Boolean) : [];
  const relationships = Array.isArray(body.relationships) ? body.relationships.map(value => {
    if (!value || typeof value !== "object") return null;
    const relation = value as Record<string, unknown>;
    return { profileId: text(relation.profileId, 90), type: text(relation.type, 40) };
  }).filter((relation): relation is { profileId: string; type: string } => Boolean(relation?.profileId && relation.type)).slice(0, 60) : [];
  const atmosphere = text(body.atmosphere, 200);

  if (!author || !caption || candidates.length === 0) {
    res.status(400).json({ error: "author, post.caption and availableAccounts are required" });
    return;
  }
  if (!requestOriginIsAllowed(req)) {
    res.status(403).json({ error: "Invalid request origin" });
    return;
  }
  if (!rateLimit(req)) {
    res.status(429).json({ error: "Too many Instagram simulations. Please try again shortly." });
    return;
  }
  if (!gemini) {
    res.status(503).json({ error: "Gemini is not configured; use local comment generation" });
    return;
  }

  const available = candidates.filter(account => account.id !== author.id);
  const byId = new Map(available.map(account => [account.id, account]));
  const byUsername = new Map(available.map(account => [account.username.toLowerCase(), account]));
  const required = [...new Map([
    ...mentions.map(id => byId.get(id) ?? byUsername.get(id.replace(/^@/, "").toLowerCase())).filter((account): account is Account => Boolean(account)),
    ...relationships.map(relation => byId.get(relation.profileId)).filter((account): account is Account => Boolean(account)),
    ...contextRequests.map(id => byId.get(id) ?? byUsername.get(id.replace(/^@/, "").toLowerCase())).filter((account): account is Account => Boolean(account)),
  ].map(account => [account.id, account])).values()];
  const contextual = available.filter(account => !required.some(item => item.id === account.id)).slice(0, 50);

  try {
    const completion = await gemini.models.generateContent({
      model: geminiUsesDirectKey ? "gemini-1.5-flash" : "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify({
          author,
          post: { caption, context, location, category },
          mentions,
          contextRequests,
          relationships,
          atmosphere,
          requiredAccounts: required,
          availableAccounts: contextual,
        }) }],
      }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.85,
      },
    });
    const raw = (completion.text ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(raw) as unknown;
    const values = parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).comments)
      ? (parsed as { comments: unknown[] }).comments
      : [];
    const byAuthor = new Map<string, { authorId: string; text: string }>();
    for (const value of values) {
      if (!value || typeof value !== "object") continue;
      const item = value as Record<string, unknown>;
      const username = text(item.user ?? item.username ?? item.authorId, 40).replace(/^@/, "").toLowerCase();
      const account = byUsername.get(username) ?? byId.get(text(item.authorId, 90));
      const commentText = cleanGeneratedText(item.text);
      if (account && commentText) byAuthor.set(account.id, { authorId: account.id, text: commentText });
    }
    const requiredComments = required.map(account => byAuthor.get(account.id) ?? { authorId: account.id, text: localComment(account, author) });
    const extras = [...byAuthor.values()]
      .filter(comment => !required.some(account => account.id === comment.authorId))
      .slice(0, Math.max(0, 4 - requiredComments.length));
    const fallback = contextual
      .filter(account => !required.some(item => item.id === account.id) && !extras.some(item => item.authorId === account.id))
      .slice(0, Math.max(0, 4 - requiredComments.length - extras.length))
      .map(account => ({ authorId: account.id, text: localComment(account, author) }));
    res.json({ comments: [...requiredComments, ...extras, ...fallback].slice(0, Math.max(4, requiredComments.length)) });
  } catch (error) {
    req.log.warn({ err: error }, "Gemini Instagram comment generation failed");
    res.status(503).json({ error: "Instagram comment generation is temporarily unavailable" });
  }
});

export default router;