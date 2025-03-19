import express from 'express'
import Provider from 'oidc-provider'
import asyncController from '../controllers/async.controller.js'
import interactionController from '../controllers/interaction.controller.js'
import faceController from '../controllers/face.controller.js'
import { noCache } from '../middlewares/no-cache.middleware.js'

export default (oidc: Provider) => {
	const router = express.Router()

	const { abortInteraction, confirmInteraction, interaction } = interactionController(oidc)
	const { verifyFace, enrollFace, login, register } = faceController(oidc)

	// router.post('/users', express.json(), register)

	
	router.post('/interaction/:uid/verify', noCache, asyncController(verifyFace))
	// router.post('/faces/enroll', enrollFace)

	router.post('/interaction/:uid/login', noCache, express.urlencoded({ extended: true }), asyncController(login))
	router.post('/interaction/:uid/confirm', noCache, asyncController(confirmInteraction))
	router.get('/interaction/:uid/abort', noCache, asyncController(abortInteraction))
	router.get('/interaction/:uid', noCache, asyncController(interaction))

	return router
}
