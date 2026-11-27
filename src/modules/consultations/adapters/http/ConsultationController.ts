import type { Request, Response, NextFunction } from 'express';
import type { ConsultationService } from '../../application/ConsultationService.js';
import type {
  CreateConsultationInput,
  UpdateConsultationData,
} from '../../domain/Consultation.js';

export interface ConsultationController {
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  update: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  delete: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export const createConsultationController = (
  service: ConsultationService
): ConsultationController => {
  const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = req.body as CreateConsultationInput;
      const created = await service.create(input);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  const getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultations = await service.getAll();
      res.status(200).json(consultations);
    } catch (error) {
      next(error);
    }
  };

  const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params['id']);
      const consultation = await service.getById(id);
      res.status(200).json(consultation);
    } catch (error) {
      next(error);
    }
  };

  const update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params['id']);
      const data = req.body as UpdateConsultationData;
      const updated = await service.update(id, data);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  const deleteById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params['id']);
      await service.delete(id);
      res.status(200).json({ message: 'Consulta médica eliminada exitosamente.' });
    } catch (error) {
      next(error);
    }
  };

  return {
    create,
    getAll,
    getById,
    update,
    delete: deleteById,
  };
};
