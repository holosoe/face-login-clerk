import { NextFunction, Request, Response } from 'express'
import Provider from 'oidc-provider'
import * as accountService from '../services/account.service.js'

function debug(obj: any) {
    return Object.entries(obj)
        .map((ent: [string, any]) => `<strong>${ent[0]}</strong>: ${JSON.stringify(ent[1])}`)
        .join('<br>')
}

export default (oidc: Provider): { [key: string]: (req: Request, res: Response) => Promise<void> } => ({
    // login, interact with FaceTec
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
    // FaceTec API /match-3d-3d
    verifyFace: async (req, res) => {
        console.log('verify', req.headers, req.body)
        const {
            prompt: { name },
        } = await oidc.interactionDetails(req, res)

    },
    // FaceTec API /match-3d-3d
    enrollFace: async (req, res) => {
        console.log('entroll', req.headers, req.body)
        const {
            prompt: { name },
        } = await oidc.interactionDetails(req, res)

    },
})
