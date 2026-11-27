import type { Request, Response, NextFunction } from 'express';
import type { PatientService } from '../../application/PatientService.js';
import type { CreatePatientData } from '../../domain/Patient.js';

export interface PatientController {
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export const createPatientController = (service: PatientService): PatientController => {
  const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreatePatientData;
      const created = await service.create(data);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  const getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patients = await service.getAll();
      res.status(200).json(patients);
    } catch (error) {
      next(error);
    }
  };

  const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params['id']);
      const patient = await service.getById(id);
      res.status(200).json(patient);
    } catch (error) {
      next(error);
    }
  };

  return {
    create,
    getAll,
    getById,
  };
};
