import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the Firebase SDK into its own chunk (keeps the app chunk lean and
        // clears the >500 kB warning).
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Phaser is ~1.4 MB on its own — split it out so it caches independently
          // and the app chunk (lesson content + React) stays lean.
          phaser: ['phaser'],
        },
      },
    },
  },
})
