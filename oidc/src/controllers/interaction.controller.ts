import { NextFunction, Request, Response } from 'express'
import Provider from 'oidc-provider'
import * as accountService from '../services/account.service.js'

function debug(obj: any) {
	return Object.entries(obj)
		.map((ent: [string, any]) => `<strong>${ent[0]}</strong>: ${JSON.stringify(ent[1])}`)
		.join('<br>')
}

export default (oidc: Provider): { [key: string]: (req: Request, res: Response) => Promise<void> } => ({
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
	// abort, end the interaction session in DB
	abortInteraction: async (req, res) => {
		const result = {
			error: 'access_denied',
			error_description: 'End-User aborted interaction',
		}
		await oidc.interactionFinished(req, res, result, {
			mergeWithLastSubmission: false,
		})
	},
	// show either login page or consent page
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

	}
})
