import { Request, Response, NextFunction } from 'express'
import Provider from 'oidc-provider'

export const onlyClient = (oidc: Provider) => async (req: Request, res: Response, next: NextFunction) => {
	const clientCredentials = await oidc.ClientCredentials.find(
		req.headers.authorization?.replace(/^Bearer /, '') ?? '',
	)
	if (clientCredentials) {
		next()
	} else {
		res.status(401).send('UNAUTHORIZED')
		return
	}
}
