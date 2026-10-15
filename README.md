# Cofulent Solutions

Vite + React + TypeScript. All page code is in `src/App.tsx`.

- Local: `npm install && npm run dev`
- Cloudflare Pages: build command `npm run build`, output directory `dist`
- Hero form posts to `/api/lead` (`functions/api/lead.ts`). Set env var `LEAD_WEBHOOK_URL` (Zapier/Make/Slack webhook) in Pages settings; without it the form shows a call-us error instead of faking success.
- Scroll frames live in `public/Plumberanimated/`.
