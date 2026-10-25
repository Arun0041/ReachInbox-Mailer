import { Client } from "@elastic/elasticsearch";
import { config } from "../config.js";
import type { EmailRow } from "../db/pool.js";

const INDEX = "emails";

export const es = new Client({ node: config.elasticNode });

export async function ensureIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await es.indices.create({
      index: INDEX,
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          subject: { type: "text" },
          body: { type: "text" },
          to_name: { type: "text", fields: { keyword: { type: "keyword" } } },
          to_email: { type: "text", fields: { keyword: { type: "keyword" } } },
          from_email: { type: "keyword" },
          status: { type: "keyword" },
          scheduled_at: { type: "date" },
          sent_at: { type: "date" },
        },
      },
    });
    console.log(`[elastic] index "${INDEX}" created`);
  }
}

export async function indexEmail(email: EmailRow): Promise<void> {
  await es.index({
    index: INDEX,
    id: String(email.id),
    document: {
      subject: email.subject,
      body: email.body,
      to_name: email.to_name ?? email.to_email,
      to_email: email.to_email,
      from_email: email.from_email,
      status: email.status,
      scheduled_at: email.scheduled_at,
      sent_at: email.sent_at,
    },
  });
}

export interface SearchHit {
  id: number;
  score: number;
}

export async function searchEmailIds(
  q: string,
  status: "scheduled" | "sent" | undefined,
): Promise<number[] | null> {
  try {
    const res = await es.search({
      index: INDEX,
      query: {
        bool: {
          must: q
            ? {
                multi_match: {
                  query: q,
                  fields: ["subject^2", "body", "to_name", "to_email"],
                  fuzziness: "AUTO",
                },
              }
            : { match_all: {} },
          filter: status ? [{ term: { status } }] : [],
        },
      },
      size: 200,
    });
    return res.hits.hits.map((h) => Number(h._id));
  } catch (err) {
    console.warn("[elastic] search unavailable, falling back to SQL:", (err as Error).message);
    return null;
  }
}
