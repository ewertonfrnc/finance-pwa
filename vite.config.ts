import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Finance PWA',
        short_name: 'Finance',
        description:
          'Organize transações e antecipe o impacto delas no seu mês.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f3eee4',
        theme_color: '#123c35',
        categories: ['finance'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [],
      },
    }),
  ],
})
