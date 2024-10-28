import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';
import { debouncedSnapshot } from '../utils/git';

const sendTokenAmount: RequestHandler = async (req, res) => {
	const { personaId, toAddress, tokenId, amount } = req.body as {
		personaId: string;
		toAddress: string;
		tokenId: string;
		amount: string;
	};
	res.send({ block: await Personas.get().sendToken(personaId, toAddress, tokenId, amount) });
	debouncedSnapshot();
};

export default sendTokenAmount;
