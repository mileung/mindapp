import Ajv from 'ajv';
import cors from 'cors';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import root from './routes/_root';
import addSpaceAuthor from './routes/add-space-author';
import addTag from './routes/add-tag';
import deleteThought from './routes/delete-thought';
import { getFile } from './routes/get-file';
import getRootSettings from './routes/get-root-settings';
import getRoots from './routes/get-roots';
import getTagTree from './routes/get-tag-tree';
import leaveSpace from './routes/leave-space';
import removeTag from './routes/remove-tag';
import renameTag from './routes/rename-tag';
import saveThought from './routes/save-thought';
import showWorkingDirectory from './routes/show-working-directory';
import updatePersonas from './routes/update-personas';
import updateRootSettings from './routes/update-root-settings';
import updateSpaceAuthor from './routes/update-space-author';
import updateWorkingDirectory from './routes/update-working-directory';
import writeThought from './routes/write-thought';
import { RootSettings } from './types/RootSettings';
import { WorkingDirectory } from './types/WorkingDirectory';
import env from './utils/env';
import { rootSettingsPath, touchIfDne } from './utils/files';
import { verifyItem } from './utils/security';
import { minute } from './utils/time';
import voteOnThought from './routes/vote-on-thought';
import deleteVote from './routes/delete-vote';
import getVotes from './routes/get-votes';
import saveRoots from './routes/save-roots';
import bodyParser from 'body-parser';

const app = express();
const port = env.GLOBAL_HOST ? 8080 : 2000;
const host = env.GLOBAL_HOST || `localhost:${port}`;

app.use(cors());
if (!env.GLOBAL_HOST) {
	// to prevent "request entity too large" error when calling save-roots
	app.use(bodyParser.json({ limit: '50mb', type: 'application/json' }));
}
app.use(express.json());
app.use((req, res, next) => {
	// console.log(`${req.url} ${req.body}`);	// logger
	next();
});

const tryCatch = (controller: RequestHandler) =>
	(async (req, res, next) => {
		try {
			await controller(req, res, next);
		} catch (error) {
			console.error(error);
			return next(error);
		}
	}) as RequestHandler;

// This is the only public root that doesn't require auth and isn't rate limited
app.get('/', tryCatch(root));

if (!env.GLOBAL_HOST) {
	// Local-only routes
	app.post('/update-working-directory', tryCatch(updateWorkingDirectory));
	app.get('/get-root-settings', tryCatch(getRootSettings));
	app.post('/update-root-settings', tryCatch(updateRootSettings));
	app.get('/get-tag-tree', tryCatch(getTagTree));
	app.post('/add-tag', tryCatch(addTag));
	app.post('/remove-tag', tryCatch(removeTag));
	app.post('/rename-tag', tryCatch(renameTag));
	app.get('/file/:fileName', tryCatch(getFile));
	app.get('/show-working-directory', tryCatch(showWorkingDirectory));
	app.post('/save-thought', tryCatch(saveThought));
	app.post('/save-roots', tryCatch(saveRoots));
	app.post('/update-personas', tryCatch(updatePersonas));
}

const ajv = new Ajv({ verbose: true });

const schema = {
	type: 'object',
	properties: {
		message: {
			type: 'object',
			properties: {
				from: { type: 'string' },
				to: { type: 'string' },
			},
			required: ['to'],
			additionalProperties: true,
		},
		fromSignature: { type: 'string' },
	},
	required: ['message'],
	additionalProperties: false,
};

type Message = {
	[key: string]: any;
	to: string;
	from?: string;
};

app.use((req, res, next) => {
	// console.log('Public route');
	const { message, fromSignature } = req.body as {
		message: Message;
		fromSignature?: string;
	};
	if (!ajv.validate(schema, req.body)) {
		throw new Error('Invalid public route request body: ' + JSON.stringify(req.body));
	}
	const to = new URL(message.to);
	if (env.GLOBAL_HOST && (to.host !== host || to.pathname !== req.url)) {
		throw new Error('Wrong recipient');
	}
	if (message.from) {
		if (!fromSignature) throw new Error('Missing fromSignature');
		const valid = verifyItem(message, message.from, fromSignature);
		if (!valid) throw new Error('Invalid fromSignature');
	}
	next();
});

const pass: RequestHandler = (req, res, next) => next();

const writeLimiter = env.GLOBAL_HOST
	? rateLimit({
			windowMs: 10 * minute,
			max: 20,
			message: JSON.stringify({ error: 'Too many requests from this IP' }),
		})
	: pass;

const standardLimiter = env.GLOBAL_HOST
	? rateLimit({
			windowMs: 10 * minute,
			max: 100,
			message: JSON.stringify({ error: 'Too many requests from this IP' }),
		})
	: pass;

// Public routes
app.post('/write-thought', writeLimiter, tryCatch(writeThought));
app.post('/delete-thought', standardLimiter, tryCatch(deleteThought));
app.post('/get-roots', standardLimiter, tryCatch(getRoots));
app.post('/get-votes', standardLimiter, tryCatch(getVotes));
app.post('/update-space-author', standardLimiter, tryCatch(updateSpaceAuthor));
app.post('/add-space-author', standardLimiter, tryCatch(addSpaceAuthor));
app.post('/vote-on-thought', standardLimiter, tryCatch(voteOnThought));
app.post('/delete-vote', standardLimiter, tryCatch(deleteVote));
app.post('/leave-space', standardLimiter, tryCatch(leaveSpace));

app.use(((err, req, res, next) => {
	// console.log('err:', err);
	res.status(500).json({ error: err.message });
}) as ErrorRequestHandler);

app.listen(port, () => {
	if (!env.GLOBAL_HOST) {
		touchIfDne(rootSettingsPath, JSON.stringify(new RootSettings({})));
		WorkingDirectory.current.setUp();
	}
	console.log(`Server is running at ${host}`);
});
