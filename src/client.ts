import { initEccLib, payments, Psbt } from "bitcoinjs-lib";
import { bitcoin, Network, testnet } from "bitcoinjs-lib/src/networks";
import BIP32Factory, { BIP32Interface } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import randomBytes from "randombytes";
import { ScriptBuilder } from "./script";
import { Taptree } from "bitcoinjs-lib/src/types";
import { toXOnly } from "./util";

const LEAF_VERSION_TAPSCRIPT = 0xc0;

initEccLib(ecc);
const bip32 = BIP32Factory(ecc);
const rng = randomBytes;

export const DEFAULT_CONFIG = {
    tss: {
        mainnet: "bc1qm24wp577nk8aacckv8np465z3dvmu7ry45el6y",
        testnet: "tb1qy9pqmk2pd9sv63g27jt8r657wy0d9ueeh0nqur",
    }
};

/// The evm address type, a 20 bytes hex string
export type Address = String;
export type BtcAddress = String;

export enum NETWORK {
    testnet,
    mainnet,
}

/// The BTC transactioin hash returned
export type BtcTxnHash = String;
export interface BtcInput {
    txn: BtcTxnHash,
    idx: number,
}

/// Obtain the minitial deposit fee for the target network, in satoshi
/// See https://www.zetachain.com/docs/developers/chains/bitcoin/#deposit-fee
export function getMinDepositFee(feeRate: number): number {
    return feeRate * 68 * 2;
}

const SAMPLE_BTC_INPUT = {
    txn: "06a6b0229329e2d801155e819647ec03a4a6742af7a55e093e01f7c244e86048",
    idx: 0
};

/** 
 * The client for interracting with Zetachain in BTC, providing basic util methods.
 * 
 * There are currently two ways of calling a smart contract on Zetachain from BTC:
 * - Using OP_RETURN
 * - Using Witness
 * 
 * The method used is now based on the data size. Within 80 bytes, `OP_RETURN` is used, else 
 * the data is written to Witness.
 * 
 * This class handles only the case where data is more than 80 bytes.
 */
export class ZetaBtcClient {
    /** The BTC network interracting with */
    readonly network: NETWORK;

    private reveal: RevealTxnBuilder | null;

    private constructor(network: NETWORK) {
        this.network = network;
    }

    public static testnet(): ZetaBtcClient {
        return new ZetaBtcClient(NETWORK.testnet);
    }

    public static mainnet(): ZetaBtcClient {
        return new ZetaBtcClient(NETWORK.mainnet);
    }

    public static estimateRevealTxnFee(network: NETWORK, memo: Buffer, commitAmount: number, feeRate: number): number {
        const client = new ZetaBtcClient(network);
        client.callWithWitness(memo);
        client.reveal.addInput(SAMPLE_BTC_INPUT, commitAmount);
        return client.reveal.estimateFee(commitAmount, feeRate);
    }

    /**
     * Call a target address and passing the data call.
     * 
     * @param memo The calldata that will be invoked on Zetachain
     */
    public call(
        memo: Buffer,
    ): Address {
        if (memo.length <= 80) {
            throw Error("Use op return instead");
        }
        return this.callWithWitness(memo);
    }

    public buildRevealTxn(commitTxn: BtcInput, commitAmount: number, feeRate: number): Buffer {
        if (this.reveal === null) {
            throw new Error("commit txn not built yet");
        }

        this.reveal.with_commit_tx(commitTxn, commitAmount, feeRate);
        return this.reveal.dump();
    }

    private genLeafScript(publicKey: Buffer, data: Buffer,): Buffer {
        const builder = ScriptBuilder.new(publicKey);
        builder.pushData(data);
        return builder.build();
    }

    private callWithWitness(
        data: Buffer,
    ): Address {
        const internalKey = bip32.fromSeed(rng(64), mapNetwork(this.network));

        const leafScript = this.genLeafScript(internalKey.publicKey, data);

        const scriptTree: Taptree = { output: leafScript };

        const { address: commitAddress } = payments.p2tr({
            internalPubkey: toXOnly(internalKey.publicKey),
            scriptTree,
            network: mapNetwork(this.network),
        });

        this.reveal = new RevealTxnBuilder(internalKey, leafScript, this.network);

        return commitAddress;
    }
}

class RevealTxnBuilder {
    private psbt: Psbt;
    private key: BIP32Interface;
    private leafScript: Buffer;
    private network: NETWORK

    constructor(key: BIP32Interface, leafScript: Buffer, network: NETWORK) {
        this.psbt = new Psbt({ network: mapNetwork(network) });;
        this.key = key;
        this.leafScript = leafScript;
        this.network = network;
    }

    public with_commit_tx(commitTxn: BtcInput, commitAmount: number, feeRate: number): RevealTxnBuilder {
        this.addInput(commitTxn, commitAmount);

        const fee = this.estimateFee(commitAmount, feeRate);
        if (fee > commitAmount) {
            throw Error(`Fee ${fee} more than commit amount: ${commitAmount}. Try increase commit amount.`);
        }

        this.psbt.addOutput({
            value: commitAmount - fee,
            address: this.tssAddress(),
        });

        this.psbt.signAllInputs(this.key);
        this.psbt.finalizeAllInputs();

        this.psbt.toHex();

        return this;
    }

    public addInput(commitTxn: BtcInput, commitAmount: number) {
        const scriptTree: Taptree = { output: this.leafScript };

        const { output, witness } = payments.p2tr({
            internalPubkey: toXOnly(this.key.publicKey),
            scriptTree,
            redeem: {
              output: this.leafScript,
              redeemVersion: LEAF_VERSION_TAPSCRIPT,
            },
            network: mapNetwork(this.network),
        });

        this.psbt.addInput({
            hash: commitTxn.txn.toString(),
            index: commitTxn.idx,
            witnessUtxo: { value: commitAmount, script: output! },
            tapLeafScript: [
              {
                leafVersion: LEAF_VERSION_TAPSCRIPT,
                script: this.leafScript,
                controlBlock: witness![witness!.length - 1],
              },
            ],
        });
    }

    public dump(): Buffer {
        return this.psbt.extractTransaction(true).toBuffer();
    }

    public estimateFee(amount: number, feeRate: number): number {
        const cloned = this.psbt.clone();

        cloned.addOutput({
            value: amount,
            address: this.tssAddress(),
        });

        // should have a way to avoid signing but just providing mocked signautre
        cloned.signAllInputs(this.key);
        cloned.finalizeAllInputs();

        const size = cloned.extractTransaction().virtualSize();
        return size * feeRate;
    }

    private tssAddress(): string {
        switch (this.network) {
            case NETWORK.mainnet:
                return DEFAULT_CONFIG.tss.mainnet;
            case NETWORK.testnet:
                return DEFAULT_CONFIG.tss.testnet;
        }
    }
}

function mapNetwork(network: NETWORK): Network {
    switch (network) {
        case NETWORK.mainnet:
            return bitcoin;
        case NETWORK.testnet:
            return testnet;
    }
}