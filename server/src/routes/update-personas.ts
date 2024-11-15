import { RequestHandler } from 'express';
import { Persona, Personas } from '../types/Personas';
import { debouncedSnapshot } from '../utils/git';

const updatePersonas: RequestHandler = async (req, res) => {
	const { personas } = req.body as { personas: Persona[] };
	Personas.get().update(new Personas({ list: personas }).list);
	res.send({});
	debouncedSnapshot();
};

export default updatePersonas;
