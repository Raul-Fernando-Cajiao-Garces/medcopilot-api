# MedCopilot API 🩺

API REST desarrollada con **Arquitectura Hexagonal**, **Node.js**, **Express** y **TypeScript** para la gestión de consultas médicas, triaje automatizado (`NORMAL` / `URGENT`), auditoría de interacciones metabólicas y recuperación de evidencia clínica (RAG ligero con vectores normalizados L2).

## Requisitos Técnicos
- Node.js >= 20.x
- PostgreSQL 16
- TypeScript con configuración estricta (`strict: true`, `noUncheckedIndexedAccess: true`)

## Scripts Disponibles
- `npm run dev`: Inicia el servidor en modo desarrollo en `http://localhost:3000`.
- `npm run build`: Compila el proyecto TypeScript a JavaScript.
- `npm test`: Ejecuta las 24 pruebas unitarias con repositorios en memoria.
- `npm run test:integration`: Ejecuta las 12 pruebas de integración contra la base de datos de pruebas.
- `npm run db:seed`: Inicializa las tablas en PostgreSQL e ingesta los capítulos clínicos vectorizados.

## Estructura del Proyecto
```
src/
├── modules/
│   ├── doctors/
│   ├── patients/
│   └── consultations/
└── shared/
    ├── domain/
    └── adapters/
```
