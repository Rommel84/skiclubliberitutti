import { z } from "zod";
import type { ModelMessage } from "ai";

import { createResponsesCall } from "./responses.ts";

const bodySchema = z.object({
  nome: z.string().trim().min(1).max(120),
  anno: z.union([z.number().int().min(1900).max(2100), z.literal(""), z.null()]).optional(),
  categorie: z.array(z.string().max(60)).max(6).default([]),
  attivita: z.string().trim().max(2000).default(""),
  obiettivi: z.string().trim().max(2000).default(""),
  presenze: z
    .array(
      z.object({
        data: z.string().max(20),
        attivita: z.string().max(300).default(""),
        focus: z.string().max(300).default(""),
        condizioni: z.string().max(300).default(""),
        note: z.string().max(500).default(""),
      }),
    )
    .max(15)
    .default([]),
});

const INSTRUCTIONS = [
  "Sei un preparatore e allenatore di sci alpino esperto che lavora con giovani atleti.",
  "Ti vengono forniti i dati di un atleta: le ultime sessioni a cui era presente, le attività recenti descritte dal coach e gli obiettivi.",
  "Genera in italiano, con due sezioni intitolate esattamente «RIEPILOGO DEI PROGRESSI» e «PROSSIMO FOCUS DI ALLENAMENTO»:",
  "1) un riepilogo dei progressi concreto, basato solo sulle informazioni fornite, senza inventare risultati o gare;",
  "2) un prossimo focus di allenamento personalizzato e specifico, con 2-3 indicazioni pratiche per le prossime sessioni.",
  "Tono professionale e motivante, adatto a essere condiviso con l'atleta e la famiglia. Massimo 220 parole complessive.",
].join(" ");

function aiErrorStatus(error: unknown): number {
  const e = error as { statusCode?: unknown; status?: unknown } | null;
  const s =
    typeof e?.statusCode === "number" ? e.statusCode : typeof e?.status === "number" ? e.status : 500;
  return s >= 400 && s < 600 ? s : 500;
}

function aiErrorMessage(error: unknown, status: number): string {
  const raw = (error as { message?: unknown } | null)?.message;
  const safe = typeof raw === "string" && raw.length > 0 && raw.length < 300 ? raw : "";
  if (status === 402) return safe || "Crediti AI insufficienti: ricarica i crediti del workspace.";
  if (status === 429) return "Troppe richieste: attendi qualche istante e riprova.";
  if (status === 401) return "Servizio AI non configurato correttamente.";
  if (status === 403) return safe || "Accesso al modello AI non disponibile.";
  if (status >= 500) return "Il servizio AI non risponde al momento. Riprova tra poco.";
  return safe || "Errore durante la generazione del riepilogo.";
}

export async function handleAthleteCoach(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return Response.json({ error: "Servizio AI non configurato." }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Richiesta non valida." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Dati della richiesta non validi." }, { status: 400 });
  }
  const d = parsed.data;
  if (!d.attivita && !d.obiettivi) {
    return Response.json(
      { error: "Inserisci almeno le attività recenti o gli obiettivi." },
      { status: 400 },
    );
  }

  const lines = [
    `Atleta: ${d.nome}${d.anno ? ` (anno ${d.anno})` : ""}`,
    d.categorie.length ? `Categorie: ${d.categorie.join(", ")}` : "",
    d.presenze.length
      ? "Ultime sessioni a cui era presente:\n" +
        d.presenze
          .map(
            (s) =>
              `- ${s.data}: ${s.attivita}${s.focus ? ` (focus: ${s.focus})` : ""}${s.condizioni ? `, condizioni: ${s.condizioni}` : ""}${s.note ? ` — note: ${s.note}` : ""}`,
          )
          .join("\n")
      : "",
    d.attivita ? `Attività recenti descritte dal coach: ${d.attivita}` : "",
    d.obiettivi ? `Obiettivi dell'atleta: ${d.obiettivi}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ModelMessage[] = [{ role: "user", content: lines }];

  try {
    const { result } = createResponsesCall(
      request,
      {
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey,
        model: "openai/gpt-6-astra",
      },
      messages,
      INSTRUCTIONS,
    );
    const text = (await result.text).trim();
    if (!text) {
      return Response.json(
        { error: "L'AI non ha generato alcun testo. Riprova." },
        { status: 502 },
      );
    }
    return Response.json({ testo: text });
  } catch (error) {
    const status = aiErrorStatus(error);
    return Response.json({ error: aiErrorMessage(error, status) }, { status });
  }
}
