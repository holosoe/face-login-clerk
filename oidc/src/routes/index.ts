import express from 'express'
import Provider from 'oidc-provider'
import authRouter from '../routes/auth.router.js'

export default (oidc: Provider) => {
	const router = express.Router()

	router.use('/', authRouter(oidc))

	return router
}
