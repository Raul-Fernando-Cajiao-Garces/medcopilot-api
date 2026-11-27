import { createApp } from './app.js';

const PORT = Number(process.env['PORT']) || 3000;

const startServer = (): void => {
  const app = createApp();

  app.listen(PORT, () => {
    console.log(`[MedCopilot API] Servidor médico en ejecución en http://localhost:${PORT}`);
    console.log(`[MedCopilot API] Modo de persistencia: ${process.env['DB_DRIVER'] || 'memory'}`);
    console.log(`[MedCopilot API] Origen CORS permitido: ${process.env['CORS_ORIGIN'] || 'http://localhost:5173'}`);
  });
};

startServer();
