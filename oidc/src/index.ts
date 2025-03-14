import express from 'express'
import path from 'path'
import url from 'url'
import { configuration } from './configs/configuration.js'
import { oidc } from './configs/provider.js'
import connectMongodb from './db/mongodb/connection.js'
import router from './routes/index.js'
import dotenv from "dotenv";

dotenv.config();

const start = async () => {
	await connectMongodb()

	const app = express()

	// Set up EJS as the view engine
	app.set('view engine', 'ejs')
	app.set('views', path.resolve('oidc/src/views'))

	// Serve static files
	app.use(express.static(path.resolve('public')))

	app.use(express.urlencoded({ extended: true }))

	// log requests
	app.use((req, res, next) => {
		console.log('ping', req.method, req.url);

		next();

		res.on("finish", () => {
			// console.log("finish req", req.params, req.query, req.body);
			console.log("finish res", res.statusCode, res.statusMessage);
		});
	});

	const provider = oidc(process.env.PUBLIC_OIDC_ISSUER as string, configuration)

	const prod = process.env.NODE_ENV === 'production';

	// for production environment
	// setup trust porxy
	if (prod) {
		app.enable('trust proxy');
		provider.proxy = true;

		app.use((req, res, next) => {
			if (req.secure) {
				next();
			} else if (req.method === 'GET' || req.method === 'HEAD') {
				res.redirect(url.format({
					protocol: 'https',
					host: req.get('host'),
					pathname: req.originalUrl,
				}));
			} else {
				res.status(400).json({
					error: 'invalid_request',
					error_description: 'only HTTPS is allowed',
				});
			}
		});
	}

	// middleware for oidc provider
	provider.use(async (ctx, next) => {
		/** pre-processing
		 * you may target a specific action here by matching `ctx.path`
		 */
		// console.log('pre middleware', ctx.method, ctx.path)

		await next()

		console.log('post middleware', ctx.method, ctx.oidc.route)
		console.log('#########################')
		console.log(ctx.oidc.body, ctx.oidc.error)
		console.log('#########################')
	})

	// Use the router
	app.use('/', router(provider))

	// Mount the OIDC provider
	app.use('/', provider.callback())

	app.listen(process.env.PORT_OIDC, () => {
		console.log(`oidc-provider listening on port ${process.env.PORT_OIDC}`)
	})
}

void start()
