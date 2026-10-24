<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The app itself is the self-contained `public/app.html` (vanilla JS), embedded by `src/routes/index.tsx` in an iframe; app features are edited directly in that file.
- AI features run through a TanStack server route under `src/routes/api/public/` calling `src/lib/ai/coach.server.ts` (gateway helpers in `src/lib/ai/`), because the static `app.html` can only reach the backend via plain `fetch`; keep `LOVABLE_API_KEY` server-side.
