/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        navy: {
          950: "#03060f",
          900: "#060d1f",
          800: "#0a1628",
          700: "#0e1f38",
          600: "#132848",
        },
        surface: {
          DEFAULT: "#111827",
          elevated: "#1a2438",
          border: "rgba(255,255,255,0.07)",
        },
        accent: {
          blue: "#3b82f6",
          teal: "#06b6d4",
          violet: "#8b5cf6",
        },
        gain: "#22c55e",
        loss: "#ef4444",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.4)",
        glow: "0 0 20px rgba(59,130,246,0.15)",
      },
    },
  },
  plugins: [],
};
