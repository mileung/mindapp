import { wallet, HTTP_RPC, accountBlock, AccountBlockBlock, ViteAPI } from '@vite/vitejs/es5';
import Big from 'big.js';

class TokenNetwork {
	public viteApi: typeof ViteAPI;

	constructor() {
		// const rpc = new WS_RPC('wss://node.vite.net/gvite/ws');
		const rpc = new HTTP_RPC('https://node.vite.net/gvite');
		this.viteApi = new ViteAPI(rpc, () => {
			console.log('Connected to Vite');
		});
	}

	async getBalanceInfo(walletAddress: string) {
		const res: ViteBalanceInfo = await this.viteApi.getBalanceInfo(walletAddress);
		return res;
	}

	async sendToken(
		fromAddress = '',
		mnemonic: string,
		toAddress: string,
		tokenId: string,
		amount: string,
	) {
		const { address, privateKey } = wallet.deriveAddress({ mnemonics: mnemonic, index: 0 });
		if (fromAddress !== address) throw new Error('mnemonic did not derive fromAddress');
		const { unreceived, balance } = await this.getBalanceInfo(fromAddress);
		if (unreceived.blockCount !== '0') {
			this.receiveBlocks(fromAddress, mnemonic, true);
		}
		if (balance.balanceInfoMap) {
			const tokenBalance = balance.balanceInfoMap[tokenId]?.balance || 0;
			if (new Big(tokenBalance).lt(amount)) {
				throw new Error('The vibes are off');
			}
		} else throw new Error('The vibes are off');

		const unsentBlock = accountBlock.createAccountBlock('send', {
			address: fromAddress,
			toAddress,
			tokenId: tokenId,
			amount,
		});
		unsentBlock.setProvider(this.viteApi);
		unsentBlock.setPrivateKey(privateKey);
		await unsentBlock.autoSetPreviousAccountBlock();
		unsentBlock.sign(privateKey);
		const res: typeof AccountBlockBlock = await unsentBlock.autoSendByPoW();
		return res;
	}

	async receiveBlocks(receivingAddress = '', mnemonic: string, skipBalanceCheck = false) {
		const { address, privateKey } = wallet.deriveAddress({ mnemonics: mnemonic, index: 0 });
		if (receivingAddress !== address) throw new Error('mnemonic did not derive receivingAddress');
		if (!skipBalanceCheck) {
			const balance = await tokenNetwork.getBalanceInfo(address);
			if (balance.unreceived?.blockCount === '0') return;
		}
		const receiveTask = new accountBlock.ReceiveAccountBlockTask({
			address,
			privateKey,
			provider: this.viteApi,
		});
		receiveTask.start();
	}
}

export type ViteBalanceInfo = {
	balance: {
		address: string;
		blockCount: string;
		balanceInfoMap?: {
			[tokenId: string]: {
				tokenInfo: TokenInfo;
				balance: string;
			};
		};
	};
	unreceived: {
		address: string;
		blockCount: string;
		balanceInfoMap?: {
			[tokenId: string]: {
				// "tti_5649544520544f4b454e6e40"
				tokenInfo: TokenInfo;
				balance: string;
				transactionCount: string;
			};
		};
	};
};

type TokenInfo = {
	tokenName: string;
	tokenSymbol: string;
	totalSupply: string;
	decimals: number;
	owner: string;
	tokenId: string;
	maxSupply: string;
	ownerBurnOnly: boolean;
	isReIssuable: boolean;
	index: number;
	isOwnerBurnOnly: boolean;
};

export type NewAccountBlock = {
	hash: string;
	height: string;
	// heightStr: string;
	removed: boolean;
};

export type UnreceivedBlockMessage = {
	hash: string;
	received: boolean;
	removed: boolean;
};

export type TokenApiInfo = {
	symbol: string;
	name: string;
	tokenCode: string;
	platform: string;
	tokenAddress: string;
	standard: string | null;
	url: string | null;
	tokenIndex: number | null;
	icon: null | string;
	decimal: number;
	gatewayInfo: null | {
		name: string;
		icon: string | null;
		policy: {
			en: string;
		};
		overview: {
			[language: string]: string;
		};
		links: {
			website?: string[];
			github?: string[];
			twitter?: string[];
			discord?: string[];
			whitepaper?: string[];
			explorer?: string[];
			reddit?: string[];
			email?: string[];
		};
		support: string;
		serviceSupport: string;
		isOfficial: boolean;
		level: number;
		website: string;
		mappedToken: {
			symbol: string;
			name: string | null;
			tokenCode: string;
			platform: string;
			tokenAddress: string | null;
			standard: string;
			url: string;
			tokenIndex: number | null;
			icon: string;
			decimal: number;
			mappedTokenExtras:
				| null
				| {
						symbol: string;
						name: string | null;
						tokenCode: string;
						platform: string;
						tokenAddress: string;
						standard: string;
						url: string;
						tokenIndex: number | null;
						icon: string;
						decimal: number;
						mappedTokenExtras: null;
				  }[];
		};
		url: string;
	};
};

// Not sure which ones could be null. Nbd, just need to display the values in `TransactionInfo`
export type RpcTx = {
	blockType: number;
	height: string;
	hash: string;
	prevHash: string;
	previousHash: string;
	accountAddress: string;
	address: string;
	publicKey: string;
	producer: string;
	fromAddress: string;
	toAddress: string;
	fromBlockHash: string;
	sendBlockHash: string;
	tokenId: string;
	amount: string;
	fee: string;
	data: null;
	difficulty: string;
	nonce: string;
	signature: string;
	quota: string;
	quotaByStake: string;
	quotaUsed: string;
	totalQuota: string;
	utUsed: string;
	logHash: null;
	vmLogHash: null;
	sendBlockList: null;
	triggeredSendBlockList: null;
	tokenInfo: {
		tokenName: string;
		tokenSymbol: string;
		totalSupply: string;
		decimals: number;
		owner: string;
		tokenId: string;
		maxSupply: string;
		ownerBurnOnly: boolean;
		isReIssuable: boolean;
		index: number;
		isOwnerBurnOnly: boolean;
	};
	confirmedTimes: string;
	confirmations: string;
	confirmedHash: string;
	firstSnapshotHash: string;
	firstSnapshotHeight: string;
	receiveBlockHeight: null;
	receiveBlockHash: null;
	timestamp: number;
};

export const tokenNetwork = new TokenNetwork();
