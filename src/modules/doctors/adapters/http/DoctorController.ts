import type { Request, Response, NextFunction } from 'express';
import type { DoctorService } from '../../application/DoctorService.js';
import type { CreateDoctorData } from '../../domain/Doctor.js';

export interface DoctorController {
  create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export const createDoctorController = (service: DoctorService): DoctorController => {
  const create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body as CreateDoctorData;
      const created = await service.create(data);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  const getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doctors = await service.getAll();
      res.status(200).json(doctors);
    } catch (error) {
      next(error);
    }
  };

  const getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Number(req.params['id']);
      const doctor = await service.getById(id);
      res.status(200).json(doctor);
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
