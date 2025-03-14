import { Request, Response, NextFunction } from 'express'

export const noCache = (req: Request, res: Response, next: NextFunction) => {
	res.set('Pragma', 'no-cache')
	res.set('Cache-Control', 'no-cache, no-store')
	next()
}
