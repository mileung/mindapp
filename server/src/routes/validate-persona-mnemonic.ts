import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';

const validatePersonaMnemonic: RequestHandler = (req, res) => {
	const { personaId, mnemonic } = req.body as {
		personaId: string;
		mnemonic: string;
	};
	const personas = Personas.get();
	res.send({ valid: personas.validateMnemonic(personaId, mnemonic) });
};

export default validatePersonaMnemonic;
