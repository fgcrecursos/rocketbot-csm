import { defineConfig } from 'vite';
import { resolve } from 'path';

// Multipágina: cada herramienta es su propia entrada. Los motores de cálculo
// vienen de los HTML originales y corren como scripts clásicos con estado
// global, así que separarlos por página cuesta menos que meterlos en un router.
export default defineConfig({
  server: { port: 5187, strictPort: true },
  preview: { port: 5187 },
  build: {
    /* Los envoltorios de las herramientas usan await de nivel superior para
       montar el armazón antes de cargar el motor. El objetivo por defecto de
       Vite (chrome87) no lo admite y la compilación falla. */
    target: 'es2022',
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'index.html'),
        health: resolve(__dirname, 'health.html'),
        madurez: resolve(__dirname, 'madurez.html'),
        oportunidades: resolve(__dirname, 'oportunidades.html'),
        roadmap: resolve(__dirname, 'roadmap.html'),
        publico: resolve(__dirname, 'publico.html'),
      },
    },
  },
});
