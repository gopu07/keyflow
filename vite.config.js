import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    base: '/keyflow/',
    plugins: [
        react({
            jsxRuntime: 'classic',
        }),
    ],
    server: {
        port: 3000,
        headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.firebasedatabase.app https://*.googleapis.com https://*.firebaseapp.com https://apis.google.com; connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com wss://*.firebasedatabase.app https://*.firebasedatabase.app ws://* wss://*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:;",
            'X-Frame-Options': 'DENY'
        }
    },
    preview: {
        port: 3000,
        headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseio.com https://*.firebasedatabase.app https://*.googleapis.com https://*.firebaseapp.com https://apis.google.com; connect-src 'self' https://*.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com wss://*.firebasedatabase.app https://*.firebasedatabase.app ws://* wss://*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:;",
            'X-Frame-Options': 'DENY'
        }
    }
});
//# sourceMappingURL=vite.config.js.map