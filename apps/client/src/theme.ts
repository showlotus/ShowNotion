import {
  Badge,
  createTheme,
  CSSVariablesResolver,
  MantineColorsTuple,
  Tabs,
  Tooltip,
  v8CssVariablesResolver,
} from "@mantine/core";

const blue: MantineColorsTuple = [
  "#e7f3ff",
  "#d0e4ff",
  "#a1c6fa",
  "#6ea6f6",
  "#458bf2",
  "#2b7af1",
  "#0b60d8",
  "#1b72f2",
  "#0056c1",
  "#004aac",
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

// Notion's current dark palette: dark-7 is the page/content background
// (#191919), dark-8 the layout/sidebar shell (#202020), dark-0 the primary
// text (rgba(255,255,255,0.9)), dark-1 the secondary text (#9b9b9b),
// dark-4 the divider (#373737) and dark-6 the hover surface (#2f2f2f).
const dark: MantineColorsTuple = [
  "#e6e6e6",
  "#9b9b9b",
  "#8c8c8c",
  "#6f6f6f",
  "#373737",
  "#313131",
  "#2f2f2f",
  "#191919",
  "#202020",
  "#141414",
];

export const theme = createTheme({
  colors: {
    blue,
    red,
    gray,
    dark,
  },
  defaultRadius: 'sm',
  components: {
    Tooltip: Tooltip.extend({
      defaultProps: {
        events: { hover: true, focus: true, touch: false },
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
  },
  light: {
    ...v8CssVariablesResolver(theme).light,
    // Notion's primary ink (rgb(55,53,47)) instead of pure black, for body
    // text and default-variant controls in light mode.
    "--mantine-color-text": "#37352F",
    "--mantine-color-default-color": "#37352F",
    // Notion's secondary text (rgba(55,53,47,0.65) ≈ #7d7c78) darkened just
    // enough to clear WCAG AA 4.5:1 (~5.3:1 on white, ~5.0:1 on the #f7f7f5
    // sidebar). Replaces the previous cool blue-gray #4b5563.
    "--mantine-color-dimmed": "#6b6a64",
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
  },
  dark: {
    ...v8CssVariablesResolver(theme).dark,
    // Notion's dark default-control text is 90% white, not pure white.
    "--mantine-color-default-color": "#e6e6e6",
    "--mantine-color-dark-light-color": "var(--mantine-color-gray-4)",
    "--mantine-color-dark-light-hover": "var(--mantine-color-default-hover)",
  },
});
