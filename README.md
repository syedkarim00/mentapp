# MentApp

A small, shared space to turn “we should hang out” into a plan. Create a hangout, share its link, vote on dates and places, finalize the details, RSVP, and chat in the comments. No accounts required.

## Run locally

Requires Node.js 22+ and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. Without database settings, development saves shared data on the server in ignored `.local-data/` files. This supports multiple browsers on the same development server; it is not browser-only storage. Production deliberately refuses this fallback.

## Deploy

1. Create a Supabase project and run `supabase/migrations/001_mentapp.sql` using the SQL editor.
2. Import this public GitHub repository into Vercel, using the Next.js framework preset and Node.js 22.
3. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server-side environment variables. The latter is the Supabase secret key (or legacy service-role key), never a publishable/anonymous key. Never prefix it with `NEXT_PUBLIC_` or commit it.
4. Deploy. Confirm creation, voting from a second browser, finalization, RSVP, comments, and calendar download on the production URL.

For local Supabase testing, copy `.env.example` to `.env.local` and fill in the same values. Applying the migration requires database administration access.

## Behavior and architecture

- Next.js App Router, React, TypeScript, Tailwind CSS; server API routes mediate all database access.
- Each hangout has a random 256-bit bearer link. Only its SHA-256 hash is stored as the database lookup key. Treat the URL as access to the entire event. No public event index, accounts, or organizer roles.
- Anyone holding that link can edit the plan, named votes/RSVPs, and comments or cancel the hangout. Names are normalized and reused within each event; people sharing a name should add an initial. Names are not authenticated identities.
- Supabase stores each hangout as an atomic JSON aggregate with a version column. Compare-and-swap updates retry against the latest version to prevent lost concurrent votes. This intentionally keeps the small event's options, participants, responses, and comments consistent in one transaction rather than splitting them into independently writable tables.
- Database tables have row-level security and no access for anonymous or authenticated client roles. Only the server's service role accesses them. Write rate limits are shared in PostgreSQL. On Vercel, limits use its trusted forwarded IP header; other hosts must configure a trusted IP source before production use.
- Polling refreshes every 12 seconds and on returning to the tab. The device remembers recent links and the last name, with graceful behavior when storage is unavailable.
- Event times are UTC instants with an IANA event timezone. DST gaps are rejected; ambiguous fall-back times use date-fns-tz's selected occurrence. Calendar export uses a stable UID, revision sequence, UTF-8 line folding, and a default two-hour duration.
- Reopening preserves votes and RSVPs. Choosing a different final date/place flags existing RSVPs for reconfirmation. Cancelled events remain readable and cannot be edited.
- Limits: 20 date and 20 place options, 100 named participants, 500 comments. Creation is limited to 20 requests/minute/IP and other writes to 180/minute/IP.
- No analytics. Application errors do not log event tokens, request bodies, or credentials. Hosting access logs may contain URL paths; configure the host's logging access/retention accordingly.

## API

`POST /api/hangouts`: title, description, timezone, local date strings (`YYYY-MM-DDTHH:mm`), places. Returns the token and hangout.

`GET /api/hangouts/:token`: read the shared state, without caching.

`POST /api/hangouts/:token`: discriminated actions `vote`, `rsvp`, `option`, `finalize`, `reopen`, `cancel`, `edit`, `comment`, and `deleteComment`. Schemas in `src/lib/domain.ts` define the contract. Errors use `{ error: string }` and appropriate HTTP status codes.

`GET /api/hangouts/:token/calendar`: download a finalized event as an `.ics` file.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
```

CI runs these on pushes and pull requests. Domain tests cover date conversion, normalization, lifecycle transitions, RSVP reconfirmation, comment removal, validation, and calendar escaping.

## Later releases

Persistent friend groups, optional verified accounts, reminders, shared expenses, photos, and richer conversation. Keep these separate from the initial lightweight hangout flow.
