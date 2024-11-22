import type { ErrorRequestHandler } from 'express';
import { DomainError } from '../../domain/errors/DomainError.js';
import { NotFoundError } from '../../domain/errors/NotFoundError.js';

interface PgDatabaseError extends Error {
  code?: string;
  detail?: string;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof DomainError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  const pgError = err as PgDatabaseError;
  if (pgError && typeof pgError.code === 'string') {
    if (pgError.code === '23503') {
      res.status(400).json({
        message: 'Violación de clave foránea: el registro referenciado no existe en la base de datos.',
      });
      return;
    }

    if (pgError.code === '23505') {
      res.status(400).json({
        message: 'Violación de unicidad: ya existe un registro con los mismos identificadores únicos.',
      });
      return;
    }
  }

  const message = err instanceof Error ? err.message : 'Error interno del servidor';
  res.status(500).json({ message });
};
