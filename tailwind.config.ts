import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
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
