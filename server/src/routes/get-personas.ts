import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';

const getPersonas: RequestHandler = (req, res) => {
	const { order } = req.body as { order?: string[] };
	const arr = Personas.get().getOrderedArr(order);
	res.send(arr);
};

export default getPersonas;
