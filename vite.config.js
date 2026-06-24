import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: '/typefast/',
    plugins: [
        react({
            jsxRuntime: 'classic',
        }),
    ],
    server: {
        port: 3000,
    },
});
//# sourceMappingURL=vite.config.js.map