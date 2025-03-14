import { Request, Response } from 'express'
import Provider from 'oidc-provider'
import * as accountService from '../services/account-persist.service.js'

function debug(obj: any) {
	return Object.entries(obj)
		.map((ent: [string, any]) => `<strong>${ent[0]}</strong>: ${JSON.stringify(ent[1])}`)
		.join('<br>')
}

export default (oidc: Provider): { [key: string]: (req: Request, res: Response) => Promise<void> } => ({
	login: async (req, res) => {
		const {
			prompt: { name },
		} = await oidc.interactionDetails(req, res)
		if (name === 'login') {
			const account = await accountService.get(req.body.username)
			let result: any
			if (account?.password === req.body.password) {
				result = { login: { accountId: req.body.username } }
			} else {
				result = {
					error: 'access_denied',
					error_description: 'Username or password is incorrect.',
				}
			}
			return oidc.interactionFinished(req, res, result, {
				mergeWithLastSubmission: false,
			})
		}
	},
	register: async (req, res) => {
		const body = req.body
		await accountService.set(body.username, {
			username: body.username,
			password: body.password,
		})
		res.status(200).send('User successfully created.')
	},
	confirmInteraction: async (req, res) => {
		const interactionDetails = await oidc.interactionDetails(req, res)
		const {
			prompt: { name, details },
			params,
			session: { accountId },
		} = interactionDetails as any

		if (name === 'consent') {
			const grant = interactionDetails.grantId
				? await oidc.Grant.find(interactionDetails.grantId)
				: new oidc.Grant({
						accountId,
						clientId: params.client_id as string,
				  })

			if (grant) {
				if (details.missingOIDCScope) {
					grant.addOIDCScope(details.missingOIDCScope.join(' '))
				}
				if (details.missingOIDCClaims) {
					grant.addOIDCClaims(details.missingOIDCClaims)
				}
				if (details.missingResourceScopes) {
					for (const [indicator, scopes] of Object.entries(
						details.missingResourceScopes,
					)) {
						grant.addResourceScope(indicator, (scopes as any).join(' '))
					}
				}

				const grantId = await grant.save()

				const result = { consent: { grantId } }
				await oidc.interactionFinished(req, res, result, {
					mergeWithLastSubmission: true,
				})
			}
		} else {
			res.status(400).send('Interaction prompt type must be `consent`.')
		}
	},
	abortInteraction: async (req, res) => {
		const result = {
			error: 'access_denied',
			error_description: 'End-User aborted interaction',
		}
		await oidc.interactionFinished(req, res, result, {
			mergeWithLastSubmission: false,
		})
	},
	interaction: async (req, res) => {
		const { uid, prompt, params, session } = (await oidc.interactionDetails(
			req,
			res,
		)) as any

		if (prompt.name === 'login') {
			return res.render('login', {
				uid,
				details: prompt.details,
				params,
				session: session ? debug(session) : undefined,
				title: 'Sign-In',
				dbg: {
					params: debug(params),
					prompt: debug(prompt),
				},
			})
		} else if (prompt.name === 'consent') {
			return res.render('consent', {
				uid,
				title: 'Authorize',
				clientId: params.client_id,
				scope: params.scope.replace(/ /g, ', '),
				session: session ? debug(session) : undefined,
				dbg: {
					params: debug(params),
					prompt: debug(prompt),
				},
			})
		} else {
			res.status(501).send('Not implemented.')
		}
	},
	token: async (req, res) => {
		console.log('/token', req.body)
		res.status(200).json({
			"access_token": "lAj7lW0D6CHqwE92MIVxMAFmHjVTXbwlq_zK-xxdnua",
			"expires_in": 3600,
			"id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImYyNjJhMzIxNDIxM2QxOTRjOTI5OTFkNjczNWIxNTNiIn0.eyJzdWIiOiJib2IiLCJhdF9oYXNoIjoiTUhuZi1VSEttenpDRlNHTUc1OGxQZyIsImF1ZCI6Im9pZGNfY2xpZW50IiwiZXhwIjoxNjc1NTE2NTE4LCJpYXQiOjE2NzU1MTI5MTgsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9.DgMUY32GJSWGbJJ2C-rTORTArxpfizP10YVUSc8DUPMAk5RlNn1lC3mERU1qfatGR0KdGFPlJIRn-ZsEug4DBeweam7FIl4XoAcbea7THpSA7oSwwM_Q9f0uieTBNerf0YGNUvTtGiQMlrOD3Z5rBLVUE0yqORWv9Ya29BDhhCuuivzd4DC1tqOVbUp8QrvxxieyyngiCgnGd07nXL7OLPFygJw5_PUiBl1BsuDvS3G8G33AZVZMOP8ScJWbs1ULleeQx5OUmwg7sr-r0TGaDYN5hi-wtrFZjgJ1wW0ijywnNM-HJSvxzwR-18j8pi3rFHzB1D-u7EEy2f-S6VM3Vim8Ojd-n6RUtbnocvd-uV5zFT7T_50N2WagN9tO-BYyEkxW2xVdEMBOzs96ZZnwKYUv59N0b6w_fWItohxNk4gYAhYZbGFul4U7WHOlTCsRS7S-P7JYmedBwxk3LVyN8AClxUfq30syh5avMCrEx6BG9QPMoBBOFPqmWILwivkl",
			"scope": "openid",
			"token_type": "Bearer"
		})
	},
})
