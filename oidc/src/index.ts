import express from 'express'
import path from 'path'
import url from 'url'
import { configuration } from './configs/configuration.js'
import { oidc } from './configs/provider.js'
import connectMongodb from './db/mongodb/connection.js'
import router from './routes/index.js'
import dotenv from "dotenv";

dotenv.config();

let server: any;

const start = async () => {
	await connectMongodb()

	const app = express()

	// Set up EJS as the view engine
	app.set('view engine', 'ejs')
	app.set('views', path.resolve('oidc/src/views'))

	// Serve static files
	app.use(express.static(path.resolve('public')))

	// app.use(express.urlencoded({ extended: true }))

	// log requests
	app.use((req, res, next) => {
		console.log('>>>>>');
		console.log('ping:', req.method, req.url);

		next();

		res.on("finish", () => {
			// console.log("finish req", req.params, req.query, req.body);
			console.log("finish res:", res.statusCode, res.statusMessage);
			console.log('<<<<<');
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

		await next()

		// post processing
		console.log('post middleware:', ctx.method, ctx.path, ctx.oidc.route)
		if (ctx.oidc.body) console.log(`body: ${JSON.stringify(ctx.oidc.body)}`)
		if (ctx.oidc.error) console.log(`error: ${ctx.oidc.error}`)
		if (ctx.body) console.log('ctx.body:', ctx.body)
	})

	// Use the router
	app.use('/', router(provider))

	// Mount the OIDC provider
	app.use('/', provider.callback())

	server = app.listen(process.env.PORT_OIDC, () => {
		console.log(`oidc-provider listening on port ${process.env.PORT_OIDC}`)
	})
}

try {
	await start()
} catch (err) {
	if (server?.listening) server.close();
	console.error(err);
	process.exitCode = 1;
}
