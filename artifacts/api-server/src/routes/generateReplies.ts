import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/generate-replies", async (req, res) => {
  const { tweetText, author, mentions, availableAccounts } = req.body as {
    tweetText: string;
    author: { handle: string; name: string; badge: string | null };
    mentions: string[];
    availableAccounts: Array<{ handle: string; name: string; badge: string | null; isSystem?: boolean }>;
  };

  if (!tweetText) {
    res.status(400).json({ error: "tweetText is required" });
    return;
  }

  const accountList = (availableAccounts ?? [])
    .slice(0, 40)
    .map(a => `${a.handle} (${a.name}${a.badge === "gold" ? ", ✓ certifié or" : a.badge === "blue" ? ", ✓ certifié bleu" : ""})`)
    .join("\n");

  const mentionList = (mentions ?? []).join(", ");

  const systemPrompt = `Tu es un simulateur ultra-réaliste de Twitter / X.
Tu génères des réponses authentiques à un tweet, comme si c'était une vraie conversation sur le réseau social.

RÈGLES STRICTES :
1. Si des comptes sont mentionnés (${mentionList || "aucun"}), ils DOIVENT répondre en PREMIER dans leur style exact :
   - Un club sportif : ton officiel, sobre, avec emoji du club ou 💙
   - Une banque / entreprise : ton institutionnel, professionnel, vouvoiement
   - Une compagnie aérienne : ton service client chaleureux, emojis voyage ✈️
   - Un artiste / personnalité : enthousiaste, familier, avec emojis
   - Un journaliste style "Fabrizio Romano" : commence par "Here we go !" ou "It's confirmed !"
2. Génère ensuite 1 à 3 autres réponses logiques selon le sujet du tweet (fans, clients, médias, insiders…) choisies parmi les comptes disponibles.
3. Chaque réponse doit être courte (max 2 phrases), percutante, naturelle, avec emojis appropriés.
4. Pas de réponse par le même auteur que le tweet.
5. Évite les textes génériques — chaque réponse doit refléter la personnalité et le contexte du compte.

COMPTES DISPONIBLES :
${accountList}

AUTEUR DU TWEET : ${author?.handle ?? ""} (${author?.name ?? ""})

FORMAT DE SORTIE : JSON strict, tableau d'objets :
[{ "handle": "@...", "name": "...", "content": "..." }]

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

    let replies: Array<{ handle: string; name: string; content: string }> = [];
    try {
      replies = JSON.parse(cleaned);
    } catch {
      replies = [];
    }

    res.json({ replies });
  } catch (err) {
    console.error("generate-replies error:", err);
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
