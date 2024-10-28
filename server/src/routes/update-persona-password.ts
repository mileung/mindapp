import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';

const updatePersonaPassword: RequestHandler = (req, res) => {
	const { personaId, oldPassword, newPassword } = req.body as {
		personaId: string;
		oldPassword: string;
		newPassword: string;
	};
	const personas = Personas.get();
	res.send({ changed: personas.updatePersonaPassword(personaId, oldPassword, newPassword) });
};

export default updatePersonaPassword;
