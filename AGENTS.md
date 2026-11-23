<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- XML/PDF files are parsed only in the browser and never uploaded; Lovable Cloud stores only extracted data (`cargas`, `notas`) behind invite-only email login. Why: the user requires the files themselves never leave the computer.
- Access = having any row in `user_roles` (`is_member`); admin-only actions (invites) run in `src/lib/usuarios.functions.ts` with the role checked before using the admin client. Why: open sign-up is disabled and RLS must block everyone not invited.
- Saving a carga goes through the `salvar_carga` SQL function (atomic replace by `numero_carga`); history search goes through `buscar_cargas`. Why: replacement and cross-carga search must be consistent and RLS-checked in one place.
- Parsing and business rules live in `src/lib/expedicao/` (pure functions, tested in `src/test/expedicao.test.ts`); UI only calls them. Why: rules (classification, ZIP split, picking cross-check) must stay testable without a browser.
- Browser-only libraries (exceljs, pdfjs-dist) are loaded with dynamic `import()` inside handlers. Why: keeps them out of SSR.
- The Dashboard reads one aggregate from the `dashboard_cargas(_de, _ate)` SQL function (per-carga totals + per-carga city rows); all derived metrics (averages, %, top cities, per-carga view) are pure functions in `src/lib/expedicao/dashboard.ts`, tested in `src/test/dashboard.test.ts`. Why: avoids downloading every nota and keeps the rules testable.
- `notas.numero_troca` stores the picking number for every nota type (app field `numeroPicking`); the column is kept, not renamed. Why: renaming would break the deployed app and older saved cargas.
- CTe sorting rules live in `src/lib/cte/ordenar.ts` (pure, tested in `src/test/cte.test.ts`); PDF reading/merging (pdfjs-dist, pdf-lib) in `src/lib/cte/pdf.ts`, loaded dynamically. Why: keeps rules testable and libraries out of SSR.
