import { NextFunction, Request, Response } from 'express'

/**
 * Async controller
 * @param fn - The function to be executed
 * @returns A function that resolves returned promise and catches any errors and passes the error on to Express
 */
export default (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};