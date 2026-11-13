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
- The register requires sign-in: coaches use their email plus a shared club password; register RPCs only serve approved profiles (or the admin), and approvals happen in the PIN-protected Admin backup area via PIN-checked RPCs.
- Register data is shared via the single-row `register_state` table: app.html writes through the `save_register` RPC (debounced) and polls version every 10s — keeps all devices in sync without accounts.
- Weekly backups are snapshots in `register_backups` created by a pg_cron job (Sunday 20:00 UTC) — restorable from the app's backup screen.
- Van reservations and coach choices are ID-keyed arrays in shared register state and participate in initial reconciliation, three-way merging and backup restoration so device changes retain individual records.
- The van driver selector combines the supplied roster with saved and current reservation names so all devices offer the roster without discarding legacy drivers.
