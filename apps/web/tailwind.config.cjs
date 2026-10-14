/** @type {import('tailwindcss').Config} */
module.exports = {
  content: { relative: true, files: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"] },
  theme: {
    extend: {
      colors: {
        background: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-background)"
            : `color-mix(in srgb, var(--color-background) calc(${opacityValue} * 100%), transparent)`,
        surface: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-surface)"
            : `color-mix(in srgb, var(--color-surface) calc(${opacityValue} * 100%), transparent)`,
        "surface-secondary": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-surface-secondary)"
            : `color-mix(in srgb, var(--color-surface-secondary) calc(${opacityValue} * 100%), transparent)`,
        "surface-tertiary": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-surface-tertiary)"
            : `color-mix(in srgb, var(--color-surface-tertiary) calc(${opacityValue} * 100%), transparent)`,
        "surface-muted": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-surface-muted)"
            : `color-mix(in srgb, var(--color-surface-muted) calc(${opacityValue} * 100%), transparent)`,
        border: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-border)"
            : `color-mix(in srgb, var(--color-border) calc(${opacityValue} * 100%), transparent)`,
        "border-light": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-border-light)"
            : `color-mix(in srgb, var(--color-border-light) calc(${opacityValue} * 100%), transparent)`,
        "border-muted": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-border-muted)"
            : `color-mix(in srgb, var(--color-border-muted) calc(${opacityValue} * 100%), transparent)`,
        "text-primary": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-primary)"
            : `color-mix(in srgb, var(--color-text-primary) calc(${opacityValue} * 100%), transparent)`,
        "text-secondary": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-secondary)"
            : `color-mix(in srgb, var(--color-text-secondary) calc(${opacityValue} * 100%), transparent)`,
        "text-muted": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-muted)"
            : `color-mix(in srgb, var(--color-text-muted) calc(${opacityValue} * 100%), transparent)`,
        "text-dark": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-dark)"
            : `color-mix(in srgb, var(--color-text-dark) calc(${opacityValue} * 100%), transparent)`,
        "text-darker": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-darker)"
            : `color-mix(in srgb, var(--color-text-darker) calc(${opacityValue} * 100%), transparent)`,
        "text-darkest": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-darkest)"
            : `color-mix(in srgb, var(--color-text-darkest) calc(${opacityValue} * 100%), transparent)`,
        "text-black": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-black)"
            : `color-mix(in srgb, var(--color-text-black) calc(${opacityValue} * 100%), transparent)`,
        "text-slate": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-slate)"
            : `color-mix(in srgb, var(--color-text-slate) calc(${opacityValue} * 100%), transparent)`,
        "text-slate-medium": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-text-slate-medium)"
            : `color-mix(in srgb, var(--color-text-slate-medium) calc(${opacityValue} * 100%), transparent)`,
        "chart-axis": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-chart-axis)"
            : `color-mix(in srgb, var(--color-chart-axis) calc(${opacityValue} * 100%), transparent)`,
        accent: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-accent)"
            : `color-mix(in srgb, var(--color-accent) calc(${opacityValue} * 100%), transparent)`,
        "accent-dark": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-accent-dark)"
            : `color-mix(in srgb, var(--color-accent-dark) calc(${opacityValue} * 100%), transparent)`,
        "accent-light": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-accent-light)"
            : `color-mix(in srgb, var(--color-accent-light) calc(${opacityValue} * 100%), transparent)`,
        "accent-muted": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-accent-muted)"
            : `color-mix(in srgb, var(--color-accent-muted) calc(${opacityValue} * 100%), transparent)`,
        "accent-foreground": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-accent-foreground)"
            : `color-mix(in srgb, var(--color-accent-foreground) calc(${opacityValue} * 100%), transparent)`,
        success: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success)"
            : `color-mix(in srgb, var(--color-success) calc(${opacityValue} * 100%), transparent)`,
        "success-alt": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success-alt)"
            : `color-mix(in srgb, var(--color-success-alt) calc(${opacityValue} * 100%), transparent)`,
        "success-dark": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success-dark)"
            : `color-mix(in srgb, var(--color-success-dark) calc(${opacityValue} * 100%), transparent)`,
        "success-darker": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success-darker)"
            : `color-mix(in srgb, var(--color-success-darker) calc(${opacityValue} * 100%), transparent)`,
        "success-light": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success-light)"
            : `color-mix(in srgb, var(--color-success-light) calc(${opacityValue} * 100%), transparent)`,
        "success-lightest": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success-lightest)"
            : `color-mix(in srgb, var(--color-success-lightest) calc(${opacityValue} * 100%), transparent)`,
        "success-foreground": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-success-foreground)"
            : `color-mix(in srgb, var(--color-success-foreground) calc(${opacityValue} * 100%), transparent)`,
        info: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info)"
            : `color-mix(in srgb, var(--color-info) calc(${opacityValue} * 100%), transparent)`,
        "info-dark": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info-dark)"
            : `color-mix(in srgb, var(--color-info-dark) calc(${opacityValue} * 100%), transparent)`,
        "info-medium": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info-medium)"
            : `color-mix(in srgb, var(--color-info-medium) calc(${opacityValue} * 100%), transparent)`,
        "info-light": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info-light)"
            : `color-mix(in srgb, var(--color-info-light) calc(${opacityValue} * 100%), transparent)`,
        "info-lightest": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info-lightest)"
            : `color-mix(in srgb, var(--color-info-lightest) calc(${opacityValue} * 100%), transparent)`,
        "info-foreground": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info-foreground)"
            : `color-mix(in srgb, var(--color-info-foreground) calc(${opacityValue} * 100%), transparent)`,
        "info-muted": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-info-muted)"
            : `color-mix(in srgb, var(--color-info-muted) calc(${opacityValue} * 100%), transparent)`,
        warning: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-warning)"
            : `color-mix(in srgb, var(--color-warning) calc(${opacityValue} * 100%), transparent)`,
        "warning-foreground": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-warning-foreground)"
            : `color-mix(in srgb, var(--color-warning-foreground) calc(${opacityValue} * 100%), transparent)`,
        error: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-error)"
            : `color-mix(in srgb, var(--color-error) calc(${opacityValue} * 100%), transparent)`,
        "error-foreground": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-error-foreground)"
            : `color-mix(in srgb, var(--color-error-foreground) calc(${opacityValue} * 100%), transparent)`,
        linkedin: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-linkedin)"
            : `color-mix(in srgb, var(--color-linkedin) calc(${opacityValue} * 100%), transparent)`,
        "linkedin-light": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-linkedin-light)"
            : `color-mix(in srgb, var(--color-linkedin-light) calc(${opacityValue} * 100%), transparent)`,
        "linkedin-foreground": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-linkedin-foreground)"
            : `color-mix(in srgb, var(--color-linkedin-foreground) calc(${opacityValue} * 100%), transparent)`,
        overlay: ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-overlay)"
            : `color-mix(in srgb, var(--color-overlay) calc(${opacityValue} * 100%), transparent)`,
        "overlay-dark": ({ opacityValue }) =>
          opacityValue === undefined
            ? "var(--color-overlay-dark)"
            : `color-mix(in srgb, var(--color-overlay-dark) calc(${opacityValue} * 100%), transparent)`,
      },
      maxWidth: { 360: "90rem" },
      fontFamily: { sans: ["var(--font-sans)", "sans-serif"] },
      boxShadow: { card: "var(--shadow-card)" },
      spacing: { 15: "3.75rem", 18: "4.5rem", 22: "5.5rem", 55: "13.75rem" },
    },
  },
  plugins: [],
};
