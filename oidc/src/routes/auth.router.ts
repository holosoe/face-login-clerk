import express from 'express'
import Provider from 'oidc-provider'
import authController from '../controllers/auth.controller.js'
import { noCache } from '../middlewares/no-cache.middleware.js'

export default (oidc: Provider) => {
	const router = express.Router()

	const { abortInteraction, confirmInteraction, interaction, login, register, token } =
		authController(oidc)

	router.post('/users', express.json(), register)

	router.post('/token', express.urlencoded({ extended: true }), token)

	router.post('/interaction/:uid/login', noCache, express.urlencoded({ extended: true }), login)
	router.post('/interaction/:uid/confirm', noCache, confirmInteraction)
	router.get('/interaction/:uid/abort', noCache, abortInteraction)
	router.get('/interaction/:uid', noCache, interaction)

	return router
}
