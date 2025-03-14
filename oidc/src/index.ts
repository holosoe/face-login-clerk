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

	// log requests
	app.use((req, res, next) => {
		console.log(`ping: ${req.method} ${req.url} ${req.body}`);
		next();
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
			error_description: 'do yourself a favor and only use https',
		  });
		}
	  });
	}

	// Use the router
	app.use('/', router(provider))

	// Mount the OIDC provider
	app.use('/', provider.callback())

	app.listen(process.env.PORT_OIDC, () => {
		console.log(`oidc-provider listening on port ${process.env.PORT_OIDC}`)
	})
}

void start()
