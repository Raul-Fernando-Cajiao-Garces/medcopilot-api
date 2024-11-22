import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './shared/adapters/database/pgPool.js';
import { errorHandler } from './shared/adapters/http/errorHandler.js';

// Módulos
import type { DoctorRepository } from './modules/doctors/ports/DoctorRepository.js';
import { createInMemoryDoctorRepository } from './modules/doctors/adapters/persistence/InMemoryDoctorRepository.js';
import { createPostgresDoctorRepository } from './modules/doctors/adapters/persistence/PostgresDoctorRepository.js';
import { createDoctorService } from './modules/doctors/application/DoctorService.js';
import { createDoctorController } from './modules/doctors/adapters/http/DoctorController.js';
import { createDoctorRouter } from './modules/doctors/adapters/http/doctorRouter.js';

import type { PatientRepository } from './modules/patients/ports/PatientRepository.js';
import { createInMemoryPatientRepository } from './modules/patients/adapters/persistence/InMemoryPatientRepository.js';
import { createPostgresPatientRepository } from './modules/patients/adapters/persistence/PostgresPatientRepository.js';
import { createPatientService } from './modules/patients/application/PatientService.js';
import { createPatientController } from './modules/patients/adapters/http/PatientController.js';
import { createPatientRouter } from './modules/patients/adapters/http/patientRouter.js';

import type { ConsultationRepository } from './modules/consultations/ports/ConsultationRepository.js';
import type { ClinicalCopilotPort } from './modules/consultations/ports/ClinicalCopilotPort.js';
import { createInMemoryConsultationRepository } from './modules/consultations/adapters/persistence/InMemoryConsultationRepository.js';
import { createPostgresConsultationRepository } from './modules/consultations/adapters/persistence/PostgresConsultationRepository.js';
import { createInMemoryClinicalCopilotAdapter } from './modules/consultations/adapters/copilot/InMemoryClinicalCopilotAdapter.js';
import { createExternalApiClinicalCopilotAdapter } from './modules/consultations/adapters/copilot/ExternalApiClinicalCopilotAdapter.js';
import { createConsultationService } from './modules/consultations/application/ConsultationService.js';
import { createConsultationController } from './modules/consultations/adapters/http/ConsultationController.js';
import { createConsultationRouter } from './modules/consultations/adapters/http/consultationRouter.js';

dotenv.config();

export interface AppDependencies {
  doctorRepository?: DoctorRepository;
  patientRepository?: PatientRepository;
  consultationRepository?: ConsultationRepository;
  clinicalCopilotPort?: ClinicalCopilotPort;
}

export const createApp = (dependencies: AppDependencies = {}): Express => {
  const app = express();

  // 1. CORS registrado estrictamente antes de express.json() y de las rutas
  const allowedOrigin = process.env['CORS_ORIGIN'] || 'http://localhost:5173';
  app.use(
    cors({
      origin: allowedOrigin,
      credentials: true,
    })
  );

  // 2. Parser JSON
  app.use(express.json());

  // 3. Resolución de dependencias (Inyección Hexagonal)
  const isPostgres = process.env['DB_DRIVER'] === 'postgres';

  const doctorRepo =
    dependencies.doctorRepository ??
    (isPostgres ? createPostgresDoctorRepository(pool) : createInMemoryDoctorRepository());

  const patientRepo =
    dependencies.patientRepository ??
    (isPostgres ? createPostgresPatientRepository(pool) : createInMemoryPatientRepository());

  const consultationRepo =
    dependencies.consultationRepository ??
    (isPostgres
      ? createPostgresConsultationRepository(pool)
      : createInMemoryConsultationRepository());

  const copilotPort =
    dependencies.clinicalCopilotPort ??
    (process.env['AI_API_URL']
      ? createExternalApiClinicalCopilotAdapter(
          process.env['AI_API_URL'],
          process.env['AI_API_KEY'],
          process.env['AI_MODEL']
        )
      : createInMemoryClinicalCopilotAdapter());

  // Servicios
  const doctorService = createDoctorService(doctorRepo);
  const patientService = createPatientService(patientRepo);
  const consultationService = createConsultationService(
    consultationRepo,
    patientRepo,
    doctorRepo,
    copilotPort
  );

  // Controladores
  const doctorController = createDoctorController(doctorService);
  const patientController = createPatientController(patientService);
  const consultationController = createConsultationController(consultationService);

  // 4. Ruta de salud del sistema
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'medcopilot-api',
      driver: isPostgres ? 'postgres' : 'memory',
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Rutas por módulo
  app.use('/api/doctors', createDoctorRouter(doctorController));
  app.use('/api/patients', createPatientRouter(patientController));
  app.use('/api/consultations', createConsultationRouter(consultationController));

  // 6. Middleware central de manejo de errores
  app.use(errorHandler);

  return app;
};
