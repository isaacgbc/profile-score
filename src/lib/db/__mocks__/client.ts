/**
 * In-memory Prisma mock for unit tests.
 *
 * Covers the 3 new Apify models (LinkedInProfileCache, AnonymousApifyUsage,
 * ApifyUsageLog) plus User model updates for quota fields.
 *
 * Usage in test files:
 *   vi.mock("@/lib/db/client", () => import("@/lib/db/__mocks__/client"));
 *   beforeEach(() => { (prisma as any).__test__.reset(); });
 */
import { vi } from "vitest";

type CacheRow = {
  url: string;
  urlHash: string;
  profileData: unknown;
  scrapedAt: Date;
  expiresAt: Date;
  apifyRunId: string | null;
  costUsd: number;
  id: string;
};

type AnonRow = {
  id: string;
  fingerprintHash: string;
  scrapeCount: number;
  firstScrapeAt: Date;
  lastScrapeAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  email: string;
  apifyScrapeCount: number;
  apifyScrapeQuota: number | null;
  apifyFirstScrapeAt: Date | null;
  activePlanId: string | null;
};

type LogRow = {
  id: string;
  userId: string | null;
  fingerprintHash: string | null;
  url: string | null;
  urlHash: string | null;
  cacheHit: boolean;
  apifyRunId: string | null;
  costUsd: number;
  success: boolean;
  errorCode: string | null;
  durationMs: number | null;
  createdAt: Date;
};

const cacheStore = new Map<string, CacheRow>();
const anonStore = new Map<string, AnonRow>();
const userStore = new Map<string, UserRow>();
const logStore: LogRow[] = [];

export const prisma = {
  linkedInProfileCache: {
    findUnique: vi.fn(
      async ({ where: { url } }: { where: { url: string } }) =>
        cacheStore.get(url) ?? null,
    ),
    upsert: vi.fn(
      async ({
        where: { url },
        create,
        update,
      }: {
        where: { url: string };
        create: CacheRow;
        update: Partial<CacheRow>;
      }) => {
        const existing = cacheStore.get(url);
        const row = existing
          ? { ...existing, ...update }
          : { id: crypto.randomUUID(), ...create };
        cacheStore.set(url, row as CacheRow);
        return row;
      },
    ),
    delete: vi.fn(async ({ where: { url } }: { where: { url: string } }) => {
      cacheStore.delete(url);
      return null;
    }),
  },
  anonymousApifyUsage: {
    findUnique: vi.fn(
      async ({
        where: { fingerprintHash },
      }: {
        where: { fingerprintHash: string };
      }) => anonStore.get(fingerprintHash) ?? null,
    ),
    upsert: vi.fn(
      async ({
        where: { fingerprintHash },
        create,
        update,
      }: {
        where: { fingerprintHash: string };
        create: AnonRow;
        update: Record<string, unknown>;
      }) => {
        const existing = anonStore.get(fingerprintHash);
        if (existing) {
          const resolved: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(update)) {
            if (
              val &&
              typeof val === "object" &&
              "increment" in (val as Record<string, unknown>)
            ) {
              resolved[key] =
                ((existing as Record<string, unknown>)[key] as number) +
                ((val as Record<string, number>).increment ?? 0);
            } else {
              resolved[key] = val;
            }
          }
          const row = { ...existing, ...resolved };
          anonStore.set(fingerprintHash, row as AnonRow);
          return row;
        }
        const row = { id: crypto.randomUUID(), ...create };
        anonStore.set(fingerprintHash, row as AnonRow);
        return row;
      },
    ),
  },
  user: {
    findUnique: vi.fn(
      async ({ where: { id } }: { where: { id: string } }) =>
        userStore.get(id) ?? null,
    ),
    update: vi.fn(
      async ({
        where: { id },
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const existing = userStore.get(id);
        if (!existing) throw new Error("User not found");
        const resolved: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(data)) {
          if (
            val &&
            typeof val === "object" &&
            "increment" in (val as Record<string, unknown>)
          ) {
            // Prisma atomic increment: { increment: N }
            resolved[key] =
              ((existing as Record<string, unknown>)[key] as number) +
              ((val as Record<string, number>).increment ?? 0);
          } else {
            resolved[key] = val;
          }
        }
        const row = { ...existing, ...resolved };
        userStore.set(id, row as UserRow);
        return row;
      },
    ),
  },
  apifyUsageLog: {
    create: vi.fn(async ({ data }: { data: Partial<LogRow> }) => {
      const row = {
        id: crypto.randomUUID(),
        ...data,
        createdAt: new Date(),
      } as LogRow;
      logStore.push(row);
      return row;
    }),
    count: vi.fn(async () => logStore.length),
  },
  __test__: {
    reset: () => {
      cacheStore.clear();
      anonStore.clear();
      userStore.clear();
      logStore.length = 0;
    },
    seedUser: (u: Partial<UserRow> & { id: string; email: string }) => {
      userStore.set(u.id, {
        apifyScrapeCount: 0,
        apifyScrapeQuota: null,
        apifyFirstScrapeAt: null,
        activePlanId: null,
        ...u,
      } as UserRow);
    },
    seedCache: (c: CacheRow) => {
      cacheStore.set(c.url, c);
    },
    logStore,
    cacheStore,
    anonStore,
    userStore,
  },
};
