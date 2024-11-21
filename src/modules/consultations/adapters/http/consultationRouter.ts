import { Router } from 'express';
import type { ConsultationController } from './ConsultationController.js';

export const createConsultationRouter = (controller: ConsultationController): Router => {
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

  router.put('/:id', (req, res, next) => {
    void controller.update(req, res, next);
  });

  router.delete('/:id', (req, res, next) => {
    void controller.delete(req, res, next);
  });

  return router;
};
