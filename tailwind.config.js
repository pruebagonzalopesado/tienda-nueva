/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		colors: {
			transparent: "transparent",
			current: "currentColor",
			white: "#ffffff",
			black: "#000000",
			navy: "#1a3a52",
			charcoal: "#2d3436",
			"broken-white": "#f8f7f4",
			"gold-matte": "#b8860b",
			leather: "#6b5844",
			gray: {
				50: "#f9fafb",
				100: "#f3f4f6",
				200: "#e5e7eb",
				300: "#d1d5db",
				400: "#9ca3af",
				500: "#6b7280",
				600: "#4b5563",
				700: "#374151",
				800: "#1f2937",
				900: "#111827",
			},
		},
		fontFamily: {
			serif: ["Playfair Display", "serif"],
			sans: ["Inter", "system-ui", "sans-serif"],
		},
		extend: {},
	},
};
