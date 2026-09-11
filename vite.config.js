import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Two entries: the 3D explainer (index) and the task-list pattern (tasks).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        tasks: fileURLToPath(new URL('./tasks.html', import.meta.url)),
        field: fileURLToPath(new URL('./field.html', import.meta.url)),
      },
    },
  },
});
