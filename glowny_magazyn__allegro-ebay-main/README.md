<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NU8GJGysCPmqw3Vy-372dDmHb6VIHxZ6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Vercel environment variables

Set these in Vercel for this frontend (Production/Preview):

- `VITE_API_ENDPOINT=https://allegro-warehouse-manager.vercel.app/api/warehouse-sync`
- `VITE_SYNC_TOKEN=9f3c2b4a7e5d8c1f0a9b3e7d6c5a4b2f9e1d0c3b7a6f5e4d3c2b1a0f9e8d7c6`
- Optional (real Supabase instead of mock): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Optional (raporty finansowe): `VITE_REPORTS_ENDPOINT` — endpoint zwracający miesięczne/kwartalne podsumowania Allegro/eBay. Front przekazuje query `periodType=month|quarter` i `period=YYYY-MM` lub `period=YYYY-Q#`.

## Backend (serverless) na Vercel

Dodane funkcje w `/api`:
- `POST /api/aggregate` – odświeża raport z Allegro (dzień wstecz), upsertuje do Supabase: `sales_summary` i `channel_reports`.
- `GET /api/reports` – zwraca dane dla frontu (`VITE_REPORTS_ENDPOINT`). Query: `periodType=month|quarter`, `period=YYYY-MM` lub `YYYY-Q#`.

Wymagane zmienne środowiskowe (Vercel/locals):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service role key)
- `ALLEGRO_CLIENT_ID`
- `ALLEGRO_CLIENT_SECRET`
- `ALLEGRO_REFRESH_TOKEN`
- `VITE_REPORTS_ENDPOINT` – ustaw na pełny URL funkcji `/api/reports` po deployu

Cron/scheduler: wywołuj `POST /api/aggregate` raz dziennie (np. Vercel Cron lub GitHub Actions) aby zapełniać Supabase.

The target API (allegro-warehouse-manager.vercel.app) must use the same sync token (e.g., as `WAREHOUSE_SYNC_TOKEN`) so that requests from this app are authorized.
