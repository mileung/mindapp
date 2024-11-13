import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { base58 } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sortKeysRecursively } from './js';
export type Item = string | Record<string, any> | any[];

export function encrypt(text: string, password = ''): string {
	const iv = CryptoJS.lib.WordArray.random(16);
	const key = CryptoJS.SHA256(password).toString().slice(0, 32);
	const textWordArray = CryptoJS.enc.Utf8.parse(text);
	const encrypted = CryptoJS.AES.encrypt(textWordArray, CryptoJS.enc.Utf8.parse(key), {
		iv: iv,
		mode: CryptoJS.mode.CTR,
		padding: CryptoJS.pad.NoPadding,
	});
	const encryptedBuffer = Buffer.from(encrypted.ciphertext.toString(), 'hex');
	const ivBuffer = Buffer.from(iv.toString(), 'hex');
	return `${base58.encode(ivBuffer)}:${base58.encode(encryptedBuffer)}`;
}

export function decrypt(encrypted: string, password = ''): string | null {
	try {
		const [ivEncoded, encryptedTextEncoded] = encrypted.split(':');
		const ivBuffer = Buffer.from(base58.decode(ivEncoded));
		const encryptedBuffer = Buffer.from(base58.decode(encryptedTextEncoded));
		const iv = CryptoJS.enc.Hex.parse(ivBuffer.toString('hex'));
		const encryptedHex = CryptoJS.enc.Hex.parse(encryptedBuffer.toString('hex'));
		const key = CryptoJS.SHA256(password).toString().slice(0, 32);
		const cipherParams = CryptoJS.lib.CipherParams.create({
			ciphertext: encryptedHex,
		});
		const decrypted = CryptoJS.AES.decrypt(cipherParams, CryptoJS.enc.Utf8.parse(key), {
			iv: iv,
			mode: CryptoJS.mode.CTR,
			padding: CryptoJS.pad.NoPadding,
		});
		return decrypted.toString(CryptoJS.enc.Utf8);
	} catch {
		return null;
	}
}

export function createKeyPair(mnemonic?: string) {
	mnemonic = bip39.validateMnemonic(mnemonic!, wordlist)
		? mnemonic!
		: bip39.generateMnemonic(wordlist);
	const seed = bip39.mnemonicToSeedSync(mnemonic);
	const masterKey = bip32.HDKey.fromMasterSeed(seed);
	const address_index = 0;
	const childKey = masterKey.derive(`m/44'/0'/0'/0/${address_index}`);
	return {
		privateKey: base58.encode(childKey.privateKey!),
		publicKey: base58.encode(childKey.publicKey!),
	};
}

function bufferItem(item: Item) {
	item = typeof item === 'string' ? item : JSON.stringify(sortKeysRecursively(item));
	const sha256ItemHash = CryptoJS.SHA256(item).toString(CryptoJS.enc.Hex);
	return Buffer.from(sha256ItemHash, 'hex');
}

export function signItem(item: Item, privateKey: string) {
	const privKeyBuffer = base58.decode(privateKey);
	const signature = secp256k1.sign(bufferItem(item), privKeyBuffer);
	return base58.encode(signature.toCompactRawBytes());
}

export function verifyItem(item: Item, publicKey: string, signature?: string) {
	if (!signature) return false;
	const publicKeyBuffer = base58.decode(publicKey);
	return secp256k1.verify(base58.decode(signature), bufferItem(item), publicKeyBuffer);
}

export function hashItem(item: Item) {
	return base58.encode(bufferItem(item));
}

// const encrypted = encrypt('testttetetetezzzceeeeoeooeeo', '');
// console.log('encrypted:', encrypted);
// const decrypted = decrypt(encrypted, '');
// console.log('decrypted:', decrypted);

// const mnem = 'sunset idle clerk upgrade despair tonight gaze crush candy meadow fantasy raw';
// const kp = createKeyPair();
// const signature = signItem('test', kp.privateKey);
// console.log('signature:', signature);
// const valid = verifyItem('test', kp.publicKey, signature);
// console.log('valid:', valid);
// const signature = signItem('U - ずっと いっしょよ', kp.privateKey);
// console.log('signature:', signature);
// const valid = verifyItem('U - ずっと いっしょよ', kp.publicKey, signature);
// console.log('valid:', valid);
