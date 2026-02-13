// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: node({
		mode: 'standalone'
	}),
	integrations: [react()],
	image: {
		service: {
			entrypoint: 'astro/assets/services/sharp'
		}
	},
	favicon: '/favicon.ico',
	vite: {
		plugins: [tailwindcss()],
		ssr: {
			external: ['@supabase/supabase-js'],
		},
	},
});
