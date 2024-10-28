import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';

const getPersonaMnemonic: RequestHandler = (req, res) => {
	const { personaId, password } = req.body as {
		personaId: string;
		password: string;
	};
	res.send({ mnemonic: Personas.get().getPersonaMnemonic(personaId, password) });
};

export default getPersonaMnemonic;
