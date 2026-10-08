import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Bibliotheken in eigene Dateien: Sie ändern sich selten und bleiben im Browser zwischengespeichert,
        // nach einem App-Update wird nur der (kleine) eigene Code neu geladen.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }
          ]
        }
      }
    },
    // Firebase allein ist größer als 500 kB – das ist erwartet
    chunkSizeWarningLimit: 700
  }
})
