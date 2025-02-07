// vite.config.ts
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        minify: true,
        lib: {
            entry: resolve(__dirname, 'src/ranch.ts'),
            name: 'ranch',
            fileName: 'ranch',
            formats: ['es'],
        },
        target: 'esnext',
        rollupOptions: {
            output: {
                globals: {
                    "@stomp/stompjs": "@stomp/stompjs",
                },
            },
            external: [
                "@stomp/stompjs",
            ],
        },
    },
    plugins: [
        dts({
            //rollupTypes: true, // This bundles the declarations into a file named ranch.d.ts in dist/
        }),
    ],
});
