# MedCopilot API 🩺

API REST desarrollada con **Arquitectura Hexagonal**, **Node.js**, **Express** y **TypeScript** para la gestión de consultas médicas, triaje automatizado (`NORMAL` / `URGENT`), auditoría de interacciones metabólicas y recuperación de evidencia clínica (RAG ligero con vectores normalizados L2).

---

## 📌 Indicaciones de Versiones: Backend con Días vs Sin Días

Este repositorio incluye la documentación, esquemas y backups tanto de la **Versión Original (Sin Días)** como de la **Versión Extendida (Con Días de evolución)**:

| Característica | Versión Original (Sin Días) | Versión Extendida (Con Días) |
| :--- | :--- | :--- |
| **Columna en BD** | 14 columnas en `consultations` | 15 columnas (`dias INTEGER NOT NULL DEFAULT 1`) |
| **Esquema DDL** | [`database/schema_original.sql`](./database/schema_original.sql) | [`database/schema_con_dias.sql`](./database/schema_con_dias.sql) |
| **Backup SQL Completo** | [`database/backups/backup_original.sql`](./database/backups/backup_original.sql) | [`database/backups/backup_medcopilot_dias.sql`](./database/backups/backup_medcopilot_dias.sql) |
| **Validación de Dominio** | Dolor (EVA 0-10) y Temperatura | Valida además `dias >= 0` |
| **Contexto IA / SOAP** | Basado en signos y síntomas | Incluye días de evolución clínica para evaluación temporal |

> 📖 **Guía completa paso a paso:** Consulta el documento [`PASOS_INTEGRACION_DIAS.md`](./PASOS_INTEGRACION_DIAS.md) para ver el desglose exacto de líneas y archivos modificados en cada capa hexagonal.

### Cómo alternar entre versiones de Base de Datos

```bash
# Opción 1: Restaurar Versión Original (Sin Días)
psql -U postgres -d medcopilot_db -f database/backups/backup_original.sql

# Opción 2: Restaurar Versión Extendida (Con Días)
psql -U postgres -d medcopilot_db -f database/backups/backup_medcopilot_dias.sql
```

---

## 🚀 Requisitos Técnicos
- Node.js >= 20.x
- PostgreSQL 16
- TypeScript con configuración estricta (`strict: true`, `noUncheckedIndexedAccess: true`)

## 🛠️ Scripts Disponibles
- `npm run dev`: Inicia el servidor en modo desarrollo en `http://localhost:3000`.
- `npm run build`: Compila el proyecto TypeScript a JavaScript.
- `npm test`: Ejecuta las 24 pruebas unitarias con repositorios en memoria.
- `npm run test:integration`: Ejecuta las 12 pruebas de integración contra la base de datos de pruebas.
- `npm run db:seed`: Inicializa las tablas en PostgreSQL e ingesta los capítulos clínicos vectorizados.

## 🏛️ Estructura del Proyecto (Arquitectura Hexagonal)
```
src/
├── modules/
│   ├── doctors/
│   ├── patients/
│   └── consultations/
│       ├── domain/                  # Entidades, Value Objects e invariantes (validación días)
│       ├── ports/                   # Contratos de repositorios y copiloto SOAP
│       ├── application/             # Casos de uso y orquestación
│       └── adapters/                # PostgreSQL, IA Groq y generador determinista
└── shared/
    ├── domain/
    └── adapters/
database/
├── schema.sql                       # Esquema activo
├── schema_original.sql              # Esquema sin columna dias
├── schema_con_dias.sql              # Esquema con columna dias
└── backups/
    ├── backup_original.sql          # Backup SQL completo (Sin Días)
    └── backup_medcopilot_dias.sql   # Backup SQL completo (Con Días)
```
