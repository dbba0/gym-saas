import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      if (parsed && typeof parsed === "object") {
        const scoped = parsed as { body?: unknown; query?: unknown; params?: unknown };
        if (scoped.body !== undefined) {
          req.body = scoped.body;
        }
        if (scoped.query !== undefined) {
          req.query = scoped.query as Request["query"];
        }
        if (scoped.params !== undefined) {
          req.params = scoped.params as Request["params"];
        }
      }
      return next();
    } catch (err) {
      return res.status(400).json({ message: "Validation error", details: err });
    }
  };
