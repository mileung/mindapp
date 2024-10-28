import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { RequestHandler } from 'express';
import { Personas } from '../types/Personas';

const addPersona: RequestHandler = (req, res) => {
	let { name, mnemonic, password } = req.body as {
		name: string;
		mnemonic: string;
		password: string;
	};
	const personas = Personas.get();
	mnemonic = mnemonic || bip39.generateMnemonic(wordlist, 256);
	if (!bip39.validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
	res.send(personas.addPersona({ mnemonic, password, name }));
};

export default addPersona;
