# Tars Live Chat

Real-time live chat messaging web app built for the Tars Full Stack Engineer Internship Coding Challenge 2026.

## Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **Convex** (backend, database, real-time)
- **Clerk** (authentication)
- **Tailwind CSS** (styling)

## Features

1. **Authentication** – Sign up (email/social), log in, log out. User name and avatar displayed. Profiles stored in Convex.
2. **User list & search** – List all users (excluding yourself), search by name. Click a user to open or create a conversation.
3. **One-on-one DMs** – Private conversations with real-time messages via Convex subscriptions. Sidebar shows conversations with latest message preview.
4. **Message timestamps** – Today: time only (e.g. 2:34 PM). Older: date + time (e.g. Feb 15, 2:34 PM). Different year includes year.
5. **Empty states** – Messages when there are no conversations, no messages in a chat, or no search results.
6. **Responsive layout** – Desktop: sidebar + chat side by side. Mobile: conversation list by default; tapping a conversation opens full-screen chat with a back button.
7. **Online/offline status** – Green indicator next to users who have the app open. Updates in real time.
8. **Typing indicator** – Shows “[Name] is typing…” (disappears after 2s inactivity or when a message is sent).
9. **Unread message count** – Badge on each conversation in the sidebar. Clears when the conversation is opened. Updates in real time.
10. **Smart auto-scroll** – Scrolls to the latest message when new messages arrive. If the user has scrolled up, a “↓ New messages” button is shown instead.
11. **Delete own messages** – Soft delete; shows “This message was deleted” in italics for everyone.
12. **Loading & error states** – Spinners while loading; send errors with dismiss.

## Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Convex**
   - Run `npx convex dev` and sign in or create a Convex account.
   - This creates a project, generates `convex/_generated` and adds `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.
   - In the [Convex Dashboard](https://dashboard.convex.dev), add `CLERK_JWT_ISSUER_DOMAIN` (see step 4).

3. **Clerk**
   - Create an app at [clerk.com](https://clerk.com).
   - In Clerk Dashboard → JWT Templates, add a template named **convex** (do not rename). Copy the **Issuer URL**.
   - In Convex Dashboard → Settings → Environment Variables, set `CLERK_JWT_ISSUER_DOMAIN` to that Issuer URL (dev and prod if you use both).
   - In Clerk Dashboard → API Keys, copy the Publishable Key and Secret Key.

4. **Environment**
   - Copy `.env.local.example` to `.env.local`.
   - Set:
     - `NEXT_PUBLIC_CONVEX_URL` (from Convex dashboard or `npx convex dev`)
     - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - `CLERK_SECRET_KEY`

5. **Run**
   ```bash
   npm run dev
   ```
   This starts Next.js and Convex dev. Open [http://localhost:3000](http://localhost:3000).

   **Note:** `npm run build` and static generation require `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (and other env vars) to be set. On Vercel, add all env vars in the project settings so the build and deployed app work.

## Scripts

- `npm run dev` – Next.js + Convex dev (watch mode)
- `npm run dev:next` – Next.js only
- `npm run dev:convex` – Convex dev only
- `npm run build` – Production build
- `npm run start` – Start production server

## Project structure

- `convex/` – Schema, auth config, and Convex functions (users, conversations, messages, presence, typing, unreadCounts).
- `src/app/` – Next.js App Router (layout, page).
- `src/components/` – ConvexClientProvider, ChatApp (sidebar, chat pane, message bubble).
- `src/lib/` – Helpers (e.g. formatMessageTime).

## Deployment

- Push to a **public GitHub** repo.
- Deploy on **Vercel** (import repo, add env vars including `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
- In Convex Dashboard, set `CLERK_JWT_ISSUER_DOMAIN` for production to your production Clerk Issuer URL.
