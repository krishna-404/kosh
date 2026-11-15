# ui-mui — the Kosh design system

Everything visual that more than one screen needs lives here. The app
(`apps/frontend`) composes it and adds no styling of its own.

## Layers

```
src/theme/
  tokens.ts        The ONLY file with colour literals, shadows and font names.
                   Light + dark sets; names mirror the design canvas's CSS variables.
  palette.ts       tokens → MUI palette (standard slots + the `kosh` slot)
  typography.ts    Sora (titles, headline figures) · Figtree (body) · Inter (amounts)
  components.ts    MUI component overrides: buttons, inputs, cards, dialogs, chips…
  theme.ts         createTheme: both schemes as CSS variables
  theme.types.ts   module augmentation (palette.kosh, hero Paper, extra variants)
  ThemeProvider.tsx  <KoshThemeProvider>, useThemeMode(), useLiteralPalette()
src/kosh/          The kit: presentational components. No data fetching, no routing.
src/format/        money / percent / date / person helpers (unit tested)
src/<mui group>/   Thin MUI re-exports, one component per file
```

## Rules

- **Colours**: scheme-dependent colours are read through the theme —
  `sx={(theme) => ({ color: theme.vars.palette.kosh.ink2 })}` — never from
  `tokens.ts` directly and never as literals. Fixed measures (`radii`, `sizes`,
  `avatarColors`) may be imported from `tokens.ts` inside this package.
- **One look per concept**: a level is always a `LevelBadge`, a person a
  `HolderAvatar`, an amount a `Money`. If a second look appears, fix the kit.
- **The hero card re-points tokens** (`Paper variant="hero"`): children use the
  same components as anywhere else and come out lime/pale-green on deep green.
- **Kit components take content, not data models**: props are names, amounts
  and nodes — not API objects — so the kit never depends on `zod-schemas`.
- **Accessibility is part of the component**: 44px targets, visible focus,
  labels for icon-only buttons, `aria-pressed` on chips, dialogs labelled by
  their title. Decorative marks are `aria-hidden`.
- **Adding a component**: add it here, add it to the gallery
  (`apps/frontend/src/modules/kit/pages/Kit.page.tsx`), then use it.
- Files in `kosh/` are `.tsx`, in `format/` `.ts` (the package `exports` map
  resolves types by extension). Use relative imports inside this package.
- After changing this package run `yarn workspace @connected-repo/ui-mui build`
  — the app consumes `dist/`.

`yarn lint:design` (repo root) enforces the colour, font and import rules.
