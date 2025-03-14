import express from 'express'
import path from 'path'
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

	// log requests
	app.use((req, res, next) => {
		console.log(`ping: ${req.method} ${req.url}`);
		next();
	});

	const provider = oidc(process.env.PUBLIC_OIDC_ISSUER as string, configuration)

	// Use the router
	app.use('/', router(provider))

	// Mount the OIDC provider
	app.use('/', provider.callback())

	app.listen(process.env.PORT_OIDC, () => {
		console.log(`oidc-provider listening on port ${process.env.PORT_OIDC}`)
	})
}

void start()
