import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';

const unlockPersona: RequestHandler = (req, res) => {
	const { personaId, password } = req.body as {
		personaId: string;
		password: string;
	};
	const personas = Personas.get();
	const valid = personas.unlockPersona(personaId, password);
	res.send({ locked: !valid });
};

export default unlockPersona;
