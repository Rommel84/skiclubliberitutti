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
- The register opens directly without authentication or a cloud bridge; keep existing cloud account records and permissions untouched because public access applies only to the locally persisted register.
