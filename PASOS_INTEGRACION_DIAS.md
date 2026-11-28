# 📋 Guía Técnica: Pasos de Integración del Campo "Días de Evolución" (`dias`)

Este documento detalla paso a paso las modificaciones realizadas en la arquitectura hexagonal de **MedCopilot API (`medcopilot-api`)** y su persistencia en PostgreSQL para incorporar el nuevo atributo clínico **`dias` (Días de evolución de los síntomas)**.

---

## 🏗️ Resumen de Versiones del Backend

| Componente / Aspecto | Versión Original (Sin Días) | Versión Extendida (Con Días) |
| :--- | :--- | :--- |
| **Entidad de Dominio** | `symptoms`, `temperature`, `painLevel` | + `dias?: number` (validación `>= 0`) |
| **Generación SOAP** | Triaje basado en dolor, fiebre y signos | Incorpora días de evolución en el contexto SOAP |
| **Prompt IA (Groq)** | Sin parámetro temporal | `Días de evolución: ${dias} días` para contexto RAG |
| **Esquema BD (`consultations`)** | 14 columnas | 15 columnas (`dias INTEGER NOT NULL DEFAULT 1`) |
| **Script DDL** | [`database/schema_original.sql`](./database/schema_original.sql) | [`database/schema_con_dias.sql`](./database/schema_con_dias.sql) |
| **Backup SQL Completo** | [`database/backups/backup_original.sql`](./database/backups/backup_original.sql) | [`database/backups/backup_medcopilot_dias.sql`](./database/backups/backup_medcopilot_dias.sql) |

---

## 👣 Pasos de Implementación en la Arquitectura Hexagonal

### Paso 1: Capa de Dominio (`src/modules/consultations/domain/Consultation.ts`)
1. **Extensión de Interfaces**: Se añade la propiedad opcional `dias?: number;` a:
   - `Consultation` (entidad del dominio)
   - `CreateConsultationInput` (DTO de entrada de creación)
2. **Regla de Negocio / Invariante**: Se implementa la validación clínica en la función de fábrica:
   ```typescript
   if (input.dias !== undefined && input.dias !== null) {
     if (Number.isNaN(input.dias) || input.dias < 0) {
       throw new DomainError('Los días de evolución de los síntomas deben ser un número no negativo.');
     }
   }
   ```

---

### Paso 2: Puerto del Copiloto Clínico (`src/modules/consultations/ports/ClinicalCopilotPort.ts`)
1. Se actualiza el contrato `SoapGenerationParams` para recibir `dias?: number;`, permitiendo que cualquier adaptador de IA reciba este parámetro temporal sin acoplarse a una implementación externa concreta.

---

### Paso 3: Capa de Aplicación / Caso de Uso (`src/modules/consultations/application/ConsultationService.ts`)
1. Al recibir `input: CreateConsultationInput`:
   - Se propaga `dias: input.dias ?? 1` al método `clinicalCopilot.generateSoapDraft(...)`.
   - Se almacena `dias: input.dias ?? 1` al persistir la entidad a través del puerto de repositorio.

---

### Paso 4: Adaptador de IA Externa Groq (`src/modules/consultations/adapters/copilot/ExternalApiClinicalCopilotAdapter.ts`)
1. En la construcción del prompt del sistema clínico:
   ```typescript
   `Médico tratante: ${params.doctorName}. Motivo de consulta / Síntomas: ${params.symptoms}. Días de evolución: ${params.dias ?? 1} días.`
   ```
2. Esto permite que el LLM pondere cuadros agudos vs crónicos al generar el análisis y el plan terapéutico.

---

### Paso 5: Generador SOAP Determinista (`src/modules/consultations/adapters/copilot/deterministicSoapGenerator.ts`)
1. En caso de indisponibilidad de la API externa (modo fallback/contingencia), el generador determinista incluye en la sección Subjetiva (S):
   ```typescript
   `Escala subjetiva de dolor EVA reportada: ${params.painLevel}/10. Días de evolución de los síntomas: ${params.dias ?? 1} días.`
   ```

---

### Paso 6: Adaptador de Persistencia PostgreSQL (`src/modules/consultations/adapters/persistence/PostgresConsultationRepository.ts`)
1. **Interface de fila**: Se añade `dias?: number;` a `JoinedConsultationRow`.
2. **Mapeador**: `dias: row.dias != null ? Number(row.dias) : 1` en `mapRowToConsultation`.
3. **Consulta SELECT**: Se añade la columna `c.dias` a la lista de proyección SQL.
4. **Consulta INSERT**: Se actualiza `INSERT INTO consultations (..., dias) VALUES (..., $15)`.

---

### Paso 7: Esquema y Migración de Base de Datos
1. **DDL**: En la tabla `consultations`, se agrega:
   ```sql
   dias INTEGER NOT NULL DEFAULT 1
   ```
2. **Backups Disponibles**:
   - `database/backups/backup_original.sql`: Base de datos completa en su estado inicial (sin columna `dias`).
   - `database/backups/backup_medcopilot_dias.sql`: Base de datos completa con la columna `dias` activa y datos poblados.

---

## 🔄 Cómo alternar entre versiones en la Base de Datos

### Opción A: Restaurar esquema con DDL directo
```bash
# Versión Original (Sin Días):
psql -U postgres -d medcopilot_db -f database/schema_original.sql
npm run db:seed

# Versión Extendida (Con Días):
psql -U postgres -d medcopilot_db -f database/schema_con_dias.sql
npm run db:seed
```

### Opción B: Restaurar desde Backup SQL completo
```bash
# Restaurar Versión Original (Sin Días):
psql -U postgres -d medcopilot_db -f database/backups/backup_original.sql

# Restaurar Versión Extendida (Con Días):
psql -U postgres -d medcopilot_db -f database/backups/backup_medcopilot_dias.sql
```
