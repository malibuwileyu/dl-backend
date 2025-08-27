import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from './errorHandler';

type ValidationSchema = {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
};

export const validate = (schema: ValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (schema.body) {
        const { error, value } = schema.body.validate(req.body, { abortEarly: false });
        if (error) {
          throw new ValidationError('Invalid request body', formatJoiError(error));
        }
        req.body = value;
      }

      // Validate query
      if (schema.query) {
        const { error, value } = schema.query.validate(req.query, { abortEarly: false });
        if (error) {
          throw new ValidationError('Invalid query parameters', formatJoiError(error));
        }
        req.query = value;
      }

      // Validate params
      if (schema.params) {
        const { error, value } = schema.params.validate(req.params, { abortEarly: false });
        if (error) {
          throw new ValidationError('Invalid URL parameters', formatJoiError(error));
        }
        req.params = value;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

function formatJoiError(error: Joi.ValidationError) {
  return error.details.reduce((acc, detail) => {
    const key = detail.path.join('.');
    acc[key] = detail.message;
    return acc;
  }, {} as Record<string, string>);
}