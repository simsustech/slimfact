---
'@slimfact/app': patch
---

Show which dashboard period is selected, and render the activity icons.

Two rendering bugs on `/admin/dashboard`:

- The period preset toggle (Today / This week / …) never showed a selection.
  A `DateInput` echoes `update:modelValue` on mount and again whenever a preset
  writes the input, and both are wired to `onCustomDateChange`, which forced
  `activePreset = 'custom'` — a value no option matches. The active preset is
  now derived from the resulting date range.
- The recent-activity timeline showed no icons: `iconForActivity` returned bare
  `mdi-*` names, and the names live in a plain `.ts` module that this build's
  UnoCSS does not scan, so no icon rule was generated for them. The names now
  carry the `i-` prefix and the module is in the UnoCSS include list.
