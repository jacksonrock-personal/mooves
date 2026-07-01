---
name: mooves-build-loop
description: "Implements a Mooves screen in Next.js. Use when Jackson says 'build screen X', 'implement the home feed', 'write the code for X', or 'ship it' after a mockup approval. Requires both an approved spec and an approved mockup before touching any code. Runs type-check before handing off for review. Single human gate: Jackson says 'ship it'."
tools: Read, Grep, Glob, Write, Edit, Bash
model: opus
---

# Mooves Build Loop

Takes an approved mockup and spec and implements the screen in Next.js. The mockup is the design contract — the production code should match it faithfully.

**Never implement a screen without both an approved spec and an approved mockup.** Check the screen index in `mooves-prd.md` first.

---

## Before starting: confirm prerequisites

Read `mooves-prd.md` and check the screen index for the target screen:
- Spec column must show ✅
- Mockup column must show ✅ with a filename

If either is missing, stop:

> "Screen {N} needs an approved [spec / mockup] before implementation. Run `/mooves-spec-writer` [and/or `/mooves-mockup-builder`] first."

Don't proceed without both.

---

## The workflow (5 steps)

### Step 1 — Read everything before writing anything

1. **The spec** — read the screen's full spec section from `mooves-prd.md`. Extract: user flows, states, data requirements, acceptance criteria, and out-of-scope items.

2. **The approved mockup** — read the HTML file (listed in the screen index). This is your design contract. Note the exact layout, states, copy, and interactions.

3. **The tech stack** — from `mooves-prd.md` (locked):
   - Next.js App Router + TypeScript
   - Tailwind CSS
   - Supabase (Postgres + Auth + Realtime + Storage)
   - PostHog for analytics events

4. **Existing code** — grep for related files to understand patterns already in use:
   ```bash
   find . -name "*.tsx" -not -path "*/node_modules/*" | head -30
   ```
   Read 2-3 existing screens or components in the same area so your code follows the established patterns, not your own assumptions.

5. **The data model** — from `mooves-prd.md`. Know the exact table and column names before writing any Supabase query.

### Step 2 — State your plan (one short message)

Before writing code, tell Jackson:
- Which files you'll create or modify
- The Supabase query/subscription approach for this screen's data
- Any non-obvious pattern choice you're making

Example: "About to create `app/(app)/feed/page.tsx` and `components/FriendCard.tsx`. Will use a Supabase realtime subscription on `friendships` + `users` filtered to the current user's friend list. Anything I'm reading wrong?"

Wait for a go-ahead (or a quick correction) before writing. This is cheap to fix here, expensive after code is written.

### Step 3 — Implement

Write the code based on the spec and mockup.

**Rules that don't bend:**
- TypeScript strict — no `any`, no `@ts-ignore`
- Tailwind only for styling — no inline style objects, no arbitrary CSS files
- Every visual state from the spec must be handled (empty, loading, error, populated)
- Supabase queries use the correct table/column names from the data model in `mooves-prd.md`
- No in-app messaging. Ever. Not even a placeholder.
- No engagement patterns: no unread counts, no red notification dots, no streak UI
- Auth is Supabase Auth (SMS OTP). Don't roll your own.
- Realtime (if this screen needs it): Supabase Realtime subscriptions, not polling

**PostHog events:** Track the events specified in the Analytics section of `mooves-prd.md`. If the spec calls out a specific funnel event for this screen, emit it.

Stay in scope. Don't add features not in the spec. Don't refactor unrelated files.

### Step 4 — Type-check

```bash
npx tsc --noEmit
```

Fix any errors before proceeding. Don't hand off code that doesn't type-check.

### Step 5 — Human gate

Tell Jackson what was built and where to find it:

> "Done. Created: [file list]. Run `npm run dev` and navigate to [route] to review.
>
> States to check: [list from spec].
>
> Say 'ship it' when it looks right, or tell me what to change."

**On feedback:** Make the change, re-run type-check, re-present. Iterate until Jackson says "ship it" (or "looks good", "that's it").

**On 'ship it':**
1. Update `mooves-prd.md` screen index: mark Code as ✅.
2. Confirm: "Screen {N} marked as coded. Screen index updated."

---

## What NOT to do

- Don't start without approved spec + approved mockup.
- Don't write code before stating your plan (Step 2).
- Don't use `any` or suppress TypeScript errors.
- Don't add features outside the spec — even obvious ones. File them as future work.
- Don't refactor unrelated files while implementing.
- Don't ship without a passing type-check.
- Don't mark Code as ✅ until Jackson explicitly approves.
