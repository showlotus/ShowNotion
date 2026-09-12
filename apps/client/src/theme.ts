import {
  Badge,
  createTheme,
  CSSVariablesResolver,
  MantineColorsTuple,
  Tabs,
  Tooltip,
  v8CssVariablesResolver,
} from "@mantine/core";

// Notion's interactive blue family (measured live 2026-09 from app.notion.com):
// 6 = primary fill #2383e2 (palUiBlu600), 7 = hover #0077d4, 8 = pressed/depth
// #105fad (palUiBlu700). The bright end follows Notion's blue tint ramp
// (#cee3f7 bluBacTer, #5e9fe8 bluBacAccSec) so 0-5 stay monotonic in luminance.
const blue: MantineColorsTuple = [
  "#e6f3fe",
  "#cee3f7",
  "#a8d3f3",
  "#7db8ee",
  "#5e9fe8",
  "#3d90e5",
  "#2383e2",
  "#0077d4",
  "#105fad",
  "#0d4f8f",
];

const red: MantineColorsTuple = [
  "#ffebeb",
  "#fad7d7",
  "#eeadad",
  "#e3807f",
  "#da5a59",
  "#d54241",
  "#d43535",
  "#bc2727",
  "#a82022",
  "#93151b",
];

// Notion-style warm grays. Each step keeps the luminance of Mantine's default
// cool gray but shifts the hue from blue-tinted to Notion's warm (55,53,47)
// family, so borders, hovers and muted text read warm in both color schemes.
const gray: MantineColorsTuple = [
  "#f8f8f7",
  "#f1f1ef",
  "#e9e9e7",
  "#dededc",
  "#cfceca",
  "#b4b3b0",
  "#8b8a86",
  "#4a4845",
  "#353430",
  "#232220",
];

// Notion's current dark palette (measured live 2026-09): dark-0 is the primary
// text #f0efed (texInvPri), dark-1 the secondary text #ada9a3 (texInvSec),
// dark-7 the page/content background (#191919), dark-8 the layout/sidebar shell
// (#202020), dark-4 the divider (Notion's hairline rgba(255,255,243,0.082),
// swapped from the old solid #373737 — control outlines are pinned separately
// via --mantine-color-default-border) and dark-6 the hover surface (#2f2f2f).
// Sidebar tree rows additionally use the muted #bcbab6 (texDis) — exposed as
// --notion-text-muted below.
const dark: MantineColorsTuple = [
  "#f0efed",
  "#ada9a3",
  "#8c8c8c",
  "#6f6f6f",
  "rgba(255, 255, 243, 0.082)",
  "#313131",
  "#2f2f2f",
  "#191919",
  "#202020",
  "#141414",
];

export const theme = createTheme({
  // Notion's page font stack, measured live from app.notion.com (2026-09).
  // Pure system fonts — zero webfonts. Chinese text resolves to PingFang SC
  // (macOS) / Microsoft YaHei (Windows) ahead of the Latin fallbacks.
  fontFamily:
    'ui-sans-serif, -apple-system, "system-ui", "Segoe UI Variable Display", "Segoe UI", Helvetica, "PingFang SC", "Microsoft YaHei", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
  colors: {
    blue,
    red,
    gray,
    dark,
  },
  defaultRadius: 'sm',
  // Notion's corner scale (measured live 2026-09): interactive faces
  // (buttons, sidebar rows, menu items, inputs) sit at 6px, small icon
  // containers / kbd at 4px, floating surfaces (menus, popovers, modals)
  // at 10px. lg/xl keep Mantine's defaults. Floating sheets get their
  // 10px ring-shadow treatment in styles/a11y-overrides.css (Menu passes
  // resolved defaults straight to Popover, so theme defaultProps lose).
  radius: { xs: "4px", sm: "6px", md: "10px", lg: "16px", xl: "32px" },
  components: {
    Tooltip: Tooltip.extend({
      defaultProps: {
        events: { hover: true, focus: true, touch: false },
        // Notion tooltips wrap at a 300px cap instead of running on one line.
        multiline: true,
        // Measured gap between target and chip (Mantine default: 5).
        offset: 6,
        // Notion fades the chip in over 0.05s ease-out (Mantine default: 100ms).
        transitionProps: { duration: 50, timingFunction: "ease-out" },
      },
      // Notion's tooltip chip (measured live 2026-09): 12px/1.4 text on the
      // dark accent surface in both color schemes, 6px radius, 5px 8px
      // padding and a 300px cap for wrapped labels. The Mantine default
      // radius (theme defaultRadius = sm = 6px) already matches.
      styles: {
        tooltip: {
          padding: "5px 8px",
          fontSize: "12px",
          lineHeight: 1.4,
          maxWidth: 300,
          backgroundColor: "var(--notion-tooltip-bg)",
          color: "var(--notion-tooltip-color)",
          boxShadow: "var(--notion-tooltip-shadow)",
        },
      },
    }),
    // Size badges to their content; fit-content collapses inside table cells.
    Badge: Badge.extend({
      styles: (_theme, props) => ({
        root:
          props.fullWidth || props.circle
            ? {}
            : { width: "max-content", maxWidth: "100%" },
      }),
    }),
    Tabs: Tabs.extend({
      vars: (theme, props) => ({
        root: {
          ...(props.color === "dark" && {
            "--tabs-color": "var(--mantine-color-dark-default)",
          }),
        },
      }),
    }),
  },
  /***
  components: {
    ActionIcon: ActionIcon.extend({
      vars: (_theme, props) => {
        return {
          root: {
            ...(props.variant === "subtle" &&
              props.color === "dark" && {
                "--ai-color": "var(--mantine-color-default-color)",
                "--ai-hover": "var(--mantine-color-default-hover)",
              }),
          },
        };
      },
    }),
  },
  ***/
});

export const mantineCssResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    ...v8CssVariablesResolver(theme).variables,
    "--input-error-size": theme.fontSizes.sm,
    // Notion tooltip chip (measured live 2026-09 from app.notion.com):
    // identical in light and dark themes — a dark #2C2C2B surface
    // (--c-bacAccPri) with #F0EFED text (--c-texInvPri), plus their hardcoded
    // tooltip shadow (soft drop shadow + 1px inset highlight ring).
    "--notion-tooltip-bg": "#2C2C2B",
    "--notion-tooltip-color": "#F0EFED",
    "--notion-tooltip-shadow":
      "rgba(0, 0, 0, 0.08) 0px 4px 12px -2px, rgba(255, 255, 255, 0.05) 0px 0px 0px 1px inset",
    // Font rendering switch. Mantine v9 applies smoothing on body via
    // var(--mantine-webkit-font-smoothing), so a raw `html { ... }` rule
    // loses to the body rule (direct beats inheritance). "auto" = subpixel
    // rendering (user preference, 2026-09); set "antialiased" to restore
    // Notion-style grayscale smoothing.
    "--mantine-webkit-font-smoothing": "auto",
    // Notion forces a fixed 15px scrollbar (their injected rule sets
    // `* { scrollbar-width: 15px }`); expose it so right-edge UI (floating
    // TOC rail/panel, header actions, popover anchors) can offset by the
    // gutter the content scrollbar now occupies.
    "--notion-scrollbar-size": "15px",
  },
  light: {
    ...v8CssVariablesResolver(theme).light,
    // Notion's primary ink #2c2c2b (texPri, measured live 2026-09; replaced
    // the older rgb(55,53,47)) for body text and default-variant controls.
    "--mantine-color-text": "#2C2C2B",
    "--mantine-color-default-color": "#2C2C2B",
    // Notion's secondary text (--c-texSec) #7d7a75, pixel-faithful. Known
    // deviation: 3.94:1 on white is below WCAG AA 4.5:1 (previous value
    // #6b6a64 passed at ~5.3:1). Accepted deliberately to match Notion.
    "--mantine-color-dimmed": "#7D7A75",
    // Semantic state tokens measured from app.notion.com (2026-09).
    // muted/strong drive the sidebar tree: rows rest muted, hover/selected
    // brighten to the main ink — exactly how notion.so behaves.
    "--notion-text-muted": "#7D7A75",
    "--notion-text-strong": "#2C2C2B",
    // Hover: Notion's warm-gray ~8% surface (grayscale ramp alpha Gra75).
    "--notion-hover": "rgba(84, 72, 49, 0.08)",
    // Selected (current page/tree node): one step above hover, ~12%.
    "--notion-selected": "#E9E9E7",
    // Notion hairline tokens. Dark values are measured live (2026-09);
    // light values approximate Notion's warm-gray hairlines — re-verify
    // against a light-theme capture if they look off.
    "--notion-border": "rgba(55, 53, 47, 0.09)",
    "--notion-border-strong": "rgba(55, 53, 47, 0.16)",
    // Notion simple-table tokens (measured live 2026-09): --c-borPri paints
    // every cell's 1px grid line, --cd-tabHeaRowColBac the header row/column
    // fill. Kept separate from --notion-border-strong because the light cell
    // line #e6e5e3 is lighter than the control outline.
    "--notion-table-border": "#E6E5E3",
    "--notion-table-header-bg": "#F7F6F3",
    "--notion-popover-bg": "#FFFFFF",
    // Bare RGB triplet of --notion-popover-bg, for consumers that need the
    // channel values (e.g. emoji-mart's rgb(var(--rgb-background)) surface).
    "--notion-popover-rgb": "255, 255, 255",
    "--notion-popover-shadow":
      "rgba(15, 15, 15, 0.05) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px 16px",
    "--mantine-color-dark-light-color": "#4a4845",
    "--mantine-color-dark-light-hover": "var(--mantine-color-gray-light-hover)",
    // Override the semantic error color so input error text / borders /
    // required asterisks meet WCAG AA 4.5:1 contrast on the filled-input
    // background (#f1f3f5). red.6 (#d43535) lands at 4.36:1; red.7 (#bc2727)
    // gives ~5.7:1. Does not affect other red usages.
    "--mantine-color-error": "var(--mantine-color-red-7)",
    // Bump subtle-gray icon/text color from gray.6 (#868e96, 2.99:1 on filled
    // input — fails WCAG AA 3:1 for non-text) to gray.7 (#495057, 7.35:1).
    // Affects ActionIcon variant="subtle" color="gray" (password visibility
    // toggle, row action menus, etc.).
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-7)",
    // Bump input placeholder color from gray.5 (#adb5bd, 1.87:1 on filled
    // input — fails WCAG AA 4.5:1) to #686868 (5.01:1 on filled, 5.57:1 on
    // white). Halfway between Mantine's gray.6 and gray.7 so the placeholder
    // stays visually distinct from real text while clearing the bar with a
    // safe margin. Affects placeholders across all Mantine inputs.
    "--mantine-color-placeholder": "#686868",
    // Bump variant="light" red text from red.6 (#d43535, 4.17:1 on the
    // 10% red-over-white blended pink background — fails WCAG AA 4.5:1)
    // to red.7 (#bc2727, 5.26:1). Affects every <Button color="red"
    // variant="light"> and matching Badge / Text usages (destructive
    // actions, red badges).
    "--mantine-color-red-light-color": "var(--mantine-color-red-7)",
    // Bump variant="light" green text. Green is inherently bright in
    // luminance, so even Mantine's green.9 (#2b8a3e, 3.78:1) fails 4.5:1
    // on the light-green bg. Use a custom dark green (#1b5e20, Material
    // green 900) outside the standard palette range. New contrast:
    // ~6.8:1. Affects every <Badge color="green" variant="light"> and
    // matching Button / Text usages.
    "--mantine-color-green-light-color": "#1B5E20",
    "--mantine-color-orange-light-color": "#a63508",
    // Scrollbar: the dark counterpart of Notion's 20% white thumb — a 20%
    // black bar on a transparent track, so it reads on light surfaces.
    "--notion-scrollbar-thumb": "rgba(0, 0, 0, 0.2)",
    "--notion-scrollbar-thumb-hover": "rgba(0, 0, 0, 0.32)",
    "--notion-scrollbar-track": "transparent",
  },
  dark: {
    ...v8CssVariablesResolver(theme).dark,
    // Notion's dark default-control text is #f0efed (texInvPri), not pure
    // white and no longer the old 90% white.
    "--mantine-color-default-color": "#F0EFED",
    // Notion's dark secondary text (texInvSec) for Mantine's dimmed token —
    // menu descriptions, disabled items, muted labels.
    "--mantine-color-dimmed": "#ADA9A3",
    // Sidebar tree states, measured live from app.notion.com (2026-09):
    // rows rest muted #bcbab6 (texDis); hover paints rgba(255,255,255,0.055)
    // and brightens text; selected stays one step stronger at 0.09.
    "--notion-text-muted": "#BCBAB6",
    "--notion-text-strong": "#F0EFED",
    "--notion-hover": "rgba(255, 255, 255, 0.055)",
    "--notion-selected": "rgba(255, 255, 255, 0.09)",
    // Notion hairlines, measured live 2026-09: sidebar seams paint
    // rgb(44,44,43) (their inset box-shadow line), control outlines
    // rgb(56,56,54). --mantine-color-default-border pins Mantine's default
    // outlines to border-strong so the dark-4 divider swap above doesn't
    // wash out input/card borders. Note: the popover ring no longer reuses
    // that opaque outline — on #191919 it read as a hard ring, so the
    // elevation now comes from a low-alpha light hairline plus a soft black
    // diffusion (see --notion-popover-shadow below).
    "--notion-border": "rgb(44, 44, 43)",
    "--notion-border-strong": "rgb(56, 56, 54)",
    "--mantine-color-default-border": "var(--notion-border-strong)",
    // Simple-table equivalents of the light tokens above: --c-borPri dark is
    // #383836 (same as the control outline) and --cd-tabHeaRowColBac is the
    // 3% white header fill, composited over the #191919 page background.
    "--notion-table-border": "#383836",
    "--notion-table-header-bg": "rgba(255, 255, 255, 0.03)",
    "--notion-popover-bg": "rgb(37, 37, 37)",
    "--notion-popover-rgb": "37, 37, 37",
    // Dark elevation: a faint 8% white hairline for surface separation plus
    // true-black diffusion. The shadow must be black, not the #191919 page
    // color — otherwise it is a no-op on the dark canvas and only the ring
    // shows.
    "--notion-popover-shadow":
      "rgba(255, 255, 255, 0.08) 0px 0px 0px 1px, rgba(0, 0, 0, 0.5) 0px 16px 40px -8px, rgba(0, 0, 0, 0.35) 0px 4px 12px -2px",
    // Scrollbar: Notion's dark thumb is a 20% white bar on a transparent
    // track (their injected `* { scrollbar-color: rgba(255,255,255,0.2)
    // rgba(0,0,0,0) }`, measured live 2026-09).
    "--notion-scrollbar-thumb": "rgba(255, 255, 255, 0.2)",
    "--notion-scrollbar-thumb-hover": "rgba(255, 255, 255, 0.32)",
    "--notion-scrollbar-track": "transparent",
    "--mantine-color-dark-light-color": "var(--mantine-color-gray-4)",
    "--mantine-color-dark-light-hover": "var(--mantine-color-default-hover)",
  },
});
