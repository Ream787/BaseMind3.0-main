Supabase: Remove Chatbot Secrets & Update Deployed Function

Steps to remove secrets and ensure the deployed function matches the repo:

1. Remove Gemini secret from Supabase project
   - Open your Supabase project dashboard
   - Go to Settings → API → Environment Variables / Secrets
   - Delete `GOOGLE_AI_API_KEY` (or any Gemini-related secret)

2. Update the deployed Edge Function (`server`)
   - In Supabase dashboard, go to Functions → server
   - Click 'Edit' (open the function editor)
   - Replace the function code with the current `supabase/functions/server/index.ts` contents from this repo
   - Save and redeploy the function

   Note: If you prefer CLI deployment, run `supabase functions deploy server` from a machine with Docker and the Supabase CLI configured.

3. Remove any unrelated environment variables in Vercel
   - In Vercel project settings → Environment Variables
   - Remove `VITE_GEMINI_API_KEY` or any Gemini-related keys

4. (Optional) Remove DB artifacts
   - Run the new migration `supabase/migrations/004_remove_chat_messages.sql` in Supabase SQL Editor
   - Confirm the `chat_messages` table and index are dropped

5. Verify
   - Test the app on Vercel; chatbot routes and UI are removed in the frontend
   - Check Supabase Functions logs to confirm no `/chat` handlers are present

If you'd like, I can prepare a paste-ready function `index.ts` snippet for the Supabase dashboard editor.
