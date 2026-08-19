import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitWindows = new Map<string, { startedAt: number; requests: number }>();

type ReplyCategory =
  | "WIKI_OFFICIAL"
  | "MERCATO_GLOBAL"
  | "FRANCE_INSIDERS_MEDIAS"
  | "UK_INSIDERS_MEDIAS"
  | "SPAIN_INSIDERS_MEDIAS"
  | "ITALY_INSIDERS_MEDIAS"
  | "GERMANY_INSIDERS_MEDIAS"
  | "DATA_TACTICS_INVESTIGATION";

type ReplyAccount = {
  handle: string;
  name: string;
  badge: "gold" | "blue" | null;
  category?: ReplyCategory;
  country?: string;
  isSystem?: boolean;
};

type ReplyTopic = "MERCATO" | "ANALYSIS" | "FINANCE" | "CULTURE" | "BUSINESS";

const normaliseHandle = (handle: string) => handle.startsWith("@") ? handle : `@${handle}`;

function detectTopic(tweetText: string): ReplyTopic {
  const value = tweetText.toLowerCase();
  if (/(transfert|mercato|recrue|signature|contrat|here we go|prêt|loan|deadline)/.test(value)) return "MERCATO";
  if (/(tactique|analyse|data|stat|xg|pressing|système|formation|scout)/.test(value)) return "ANALYSIS";
  if (/(finance|budget|économie|géopolitique|investissement|dette|valorisation|salaire)/.test(value)) return "FINANCE";
  if (/(cinéma|film|série|culture|musique|festival|acteur)/.test(value)) return "CULTURE";
  return "BUSINESS";
}

function allowedCategories(topic: ReplyTopic): ReplyCategory[] {
  if (topic === "MERCATO") {
    return ["MERCATO_GLOBAL", "FRANCE_INSIDERS_MEDIAS", "UK_INSIDERS_MEDIAS", "SPAIN_INSIDERS_MEDIAS", "ITALY_INSIDERS_MEDIAS", "GERMANY_INSIDERS_MEDIAS"];
  }
  if (topic === "ANALYSIS" || topic === "FINANCE") return ["DATA_TACTICS_INVESTIGATION"];
  return ["WIKI_OFFICIAL"];
}

function fallbackReply(account: ReplyAccount, topic: ReplyTopic, authorName: string) {
  if (account.handle.toLowerCase() === "@fabrizioromano") return "Here we go! Les informations sont confirmées de notre côté. Plus de détails à venir.";
  if (account.category === "WIKI_OFFICIAL") return `Merci pour votre message ${authorName}. Nos équipes restent mobilisées pour vous tenir informés.`;
  if (topic === "MERCATO") return "Information à suivre de très près. Les discussions avancent et le dossier mérite toute notre attention.";
  if (topic === "ANALYSIS") return "Les données confirment une vraie tendance. Le contexte tactique sera déterminant pour la suite.";
  if (topic === "FINANCE") return "Le sujet financier est central : il faut regarder les chiffres, le calendrier et les conséquences à moyen terme.";
  return "Intéressant, merci pour le partage. Nous suivons cette actualité avec attention.";
}

router.post("/generate-replies", async (req, res) => {
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const tweetText = typeof body.tweetText === "string" ? body.tweetText.trim() : "";
  const rawAuthor = body.author && typeof body.author === "object" ? body.author as Record<string, unknown> : {};
  const author = {
    handle: typeof rawAuthor.handle === "string" ? rawAuthor.handle.slice(0, 80) : "",
    name: typeof rawAuthor.name === "string" ? rawAuthor.name.slice(0, 100) : "",
    badge: rawAuthor.badge === "gold" || rawAuthor.badge === "blue" ? rawAuthor.badge : null,
  };
  const rawMentions = Array.isArray(body.mentions) ? body.mentions : [];
  const mentions = rawMentions.filter((value): value is string => typeof value === "string").slice(0, 12);
  const rawAccounts = Array.isArray(body.availableAccounts) ? body.availableAccounts : [];
  const requestedTopic = typeof body.topic === "string" ? body.topic as ReplyTopic : undefined;

  if (!tweetText) {
    res.status(400).json({ error: "tweetText is required" });
    return;
  }
  if (tweetText.length > 600 || rawAccounts.length > 70) {
    res.status(400).json({ error: "Tweet or account list exceeds the allowed size" });
    return;
  }

  const clientKey = req.ip || "anonymous";
  const now = Date.now();
  const currentWindow = rateLimitWindows.get(clientKey);
  const window = !currentWindow || now - currentWindow.startedAt >= RATE_LIMIT_WINDOW_MS
    ? { startedAt: now, requests: 0 }
    : currentWindow;
  if (window.requests >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: "Too many reply simulations. Please try again in a few minutes." });
    return;
  }
  window.requests += 1;
  rateLimitWindows.set(clientKey, window);

  const topic = requestedTopic && ["MERCATO", "ANALYSIS", "FINANCE", "CULTURE", "BUSINESS"].includes(requestedTopic)
    ? requestedTopic
    : detectTopic(tweetText);
  const accounts: ReplyAccount[] = rawAccounts.flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as Record<string, unknown>;
    if (typeof value.handle !== "string" || typeof value.name !== "string") return [];
    return [{
      handle: normaliseHandle(value.handle.slice(0, 80)),
      name: value.name.slice(0, 100),
      badge: value.badge === "gold" || value.badge === "blue" ? value.badge : null,
      category: typeof value.category === "string" ? value.category as ReplyCategory : "WIKI_OFFICIAL",
      country: typeof value.country === "string" ? value.country.slice(0, 12) : undefined,
      isSystem: value.isSystem === true,
    }];
  });
  const mentionedAccounts = (mentions ?? [])
    .map(handle => accounts.find(account => account.handle.toLowerCase() === normaliseHandle(handle).toLowerCase()))
    .filter((account): account is ReplyAccount => Boolean(account))
    .filter(account => account.handle.toLowerCase() !== normaliseHandle(author?.handle ?? "").toLowerCase());
  const uniqueMentions = [...new Map(mentionedAccounts.map(account => [account.handle.toLowerCase(), account])).values()];
  const contextualAccounts = accounts
    .filter(account => allowedCategories(topic).includes(account.category ?? "WIKI_OFFICIAL"))
    .filter(account => account.handle.toLowerCase() !== normaliseHandle(author?.handle ?? "").toLowerCase());
  const candidateAccounts = [...new Map([...uniqueMentions, ...contextualAccounts].map(account => [account.handle.toLowerCase(), account])).values()].slice(0, 70);

  const accountList = candidateAccounts
    .map(a => `${a.handle} (${a.name}; catégorie ${a.category ?? "WIKI_OFFICIAL"}${a.country ? `; ${a.country}` : ""}${a.badge === "gold" ? "; ✓ certifié or" : a.badge === "blue" ? "; ✓ certifié bleu" : ""})`)
    .join("\n");

  const mentionList = uniqueMentions.map(account => account.handle).join(", ");

  const systemPrompt = `Tu es un simulateur ultra-réaliste de Twitter / X.
Tu génères des réponses authentiques à un tweet, comme si c'était une vraie conversation sur le réseau social.

RÈGLES STRICTES :
1. Sujet détecté : ${topic}. Si des comptes connus sont mentionnés (${mentionList || "aucun"}), ils DOIVENT répondre en PREMIER et dans cet ordre exact, sans exception.
   - Un club sportif : ton officiel, sobre, avec emoji du club ou 💙
   - Une banque / entreprise : ton institutionnel, professionnel, vouvoiement
   - Une compagnie aérienne : ton service client chaleureux, emojis voyage ✈️
   - Un artiste / personnalité : enthousiaste, familier, avec emojis
   - Un journaliste style "Fabrizio Romano" : commence par "Here we go !" ou "It's confirmed !"
2. Après les mentions obligatoires, choisis les autres comptes uniquement dans les catégories adaptées à ${topic}. Pour un sujet culture, n'utilise jamais un insider mercato.
3. Génère au total 2 à 4 réponses (sauf si plus de 4 mentions obligatoires), courtes, percutantes et naturelles, maximum deux phrases.
4. Pas de réponse par le même auteur, pas de doublon, pas de compte inventé.
5. Évite les textes génériques — chaque réponse doit refléter la personnalité, la catégorie et le contexte du compte.

COMPTES DISPONIBLES :
${accountList}

AUTEUR DU TWEET : ${author?.handle ?? ""} (${author?.name ?? ""})

FORMAT DE SORTIE : JSON strict, tableau d'objets :
[{ "handle": "@...", "name": "...", "badge": "blue"|"gold"|null, "content": "..." }]

Ne renvoie QUE le JSON, sans markdown, sans explication.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Tweet : "${tweetText}"` },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";

    // Strip potential markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: unknown = [];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = [];
    }

    const byHandle = new Map(candidateAccounts.map(account => [account.handle.toLowerCase(), account]));
    const accepted = new Map<string, { handle: string; name: string; content: string }>();
    for (const reply of Array.isArray(parsed) ? parsed : []) {
      if (!reply || typeof reply !== "object") continue;
      const value = reply as Record<string, unknown>;
      if (typeof value.handle !== "string" || typeof value.content !== "string" || !value.content.trim()) continue;
      const account = byHandle.get(normaliseHandle(value.handle).toLowerCase());
      if (!account || account.handle.toLowerCase() === normaliseHandle(author?.handle ?? "").toLowerCase()) continue;
      accepted.set(account.handle.toLowerCase(), { handle: account.handle, name: account.name, content: value.content.trim().slice(0, 500) });
    }

    const required = uniqueMentions.map(account => ({
      handle: account.handle,
      name: account.name,
      content: accepted.get(account.handle.toLowerCase())?.content ?? fallbackReply(account, topic, author?.name ?? ""),
    }));
    const used = new Set(required.map(reply => reply.handle.toLowerCase()));
    const targetReplyCount = Math.max(2, Math.min(4, uniqueMentions.length + 2));
    const extraLimit = Math.max(0, targetReplyCount - required.length);
    const extras = [...accepted.values()].filter(reply => !used.has(reply.handle.toLowerCase())).slice(0, extraLimit);
    const fallbackExtras = candidateAccounts
      .filter(account => !used.has(account.handle.toLowerCase()) && !extras.some(reply => reply.handle.toLowerCase() === account.handle.toLowerCase()))
      .slice(0, Math.max(0, targetReplyCount - required.length - extras.length))
      .map(account => ({ handle: account.handle, name: account.name, content: fallbackReply(account, topic, author?.name ?? "") }));

    res.json({ replies: [...required, ...extras, ...fallbackExtras].slice(0, Math.max(4, required.length)) });
  } catch (err) {
    console.error("generate-replies error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
