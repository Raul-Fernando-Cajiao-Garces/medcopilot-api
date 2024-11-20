import { Router } from 'express';
import type { PatientController } from './PatientController.js';

export const createPatientRouter = (controller: PatientController): Router => {
  const router = Router();

  router.post('/', (req, res, next) => {
    void controller.create(req, res, next);
  });

  router.get('/', (req, res, next) => {
    void controller.getAll(req, res, next);
  });

  router.get('/:id', (req, res, next) => {
    void controller.getById(req, res, next);
  });

  return router;
};
