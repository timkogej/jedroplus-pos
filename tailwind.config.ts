import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Apple's system font (SF Pro) on Apple devices; sensible system fonts elsewhere.
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"',
          '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Brand violet — use `text-brand`, `bg-brand/10`, `ring-brand/30`, ... instead of hex literals.
        brand: "#6D5EF7",
      },
    },
  },
  plugins: [],
};
export default config;
