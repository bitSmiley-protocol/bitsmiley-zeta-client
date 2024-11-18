import { ethers } from "ethers";
import { encodeZeta } from "./encoding/v1";
import { BtcAddress } from "./client";

enum Operation {
    OpenVault,
    Mint,
}

interface CallOptions {
    revertAddress: BtcAddress,
}

interface OpenVaultOptions {
    // The collateral id to be used
    collateralId: string,
    // The amount of bitusd to mint
    bitusd: string,
    // The owner address of the vault creating
    ownerAddress: string,
    // The signature that proves the caller owns the "ownerAddress"
    signature: string
}

interface MintOptions {
    // The amount of bitusd to mint
    bitusd: string,
    // The owner address of the vault creating
    ownerAddress: string,
    // The signature that proves the caller owns the "ownerAddress"
    signature: string
}

export class BitSmileyCalldataGenerator {
    /**
     * The bitsmiley and zeta connector contract address
     */
    private zetaConnectorAddress: string;

    constructor(zetaConnectorAddress: string) {
        this.zetaConnectorAddress = zetaConnectorAddress;
    }

    /**
     * Generates the calldata for opening a vault
     * 
     * The signature is generate with:
     * 
     * const data = { user: "0x...", chainId: ... };
     * const domain = "bitsmiley.io";
     * const types = {
     *   VerifyInfo: [
     *      {
     *          name: 'user',
     *          type: 'address',
     *      },
     *      {
     *          name: 'chainId',
     *          type: 'uint256',
     *      },
     *   ],
     * };
     * signer.signTypedData(domain, types, data);
     */
    public openVault(callOptions: CallOptions, openVaultParams: OpenVaultOptions): string {
        const params = new ethers.AbiCoder().encode(
            ["bytes32", "address", "int256", "bytes"], 
            [
                openVaultParams.collateralId,
                openVaultParams.ownerAddress,
                ethers.parseEther(openVaultParams.bitusd),
                openVaultParams.signature
            ]
        );

        let message = new ethers.AbiCoder().encode(["uint8", "bytes"], [Operation.OpenVault, params]);
        return encodeZeta(trimOx(this.zetaConnectorAddress), Buffer.from(trimOx(message), "hex"), callOptions.revertAddress);
    }

    /**
     * Generates the calldata for minting bitusd
     */
    public mint(callOptions: CallOptions, mintOptions: MintOptions): string {
        const params = new ethers.AbiCoder().encode(
            ["address", "int256", "bytes"], 
            [mintOptions.ownerAddress, ethers.parseEther(mintOptions.bitusd), mintOptions.signature]
        );

        let message = new ethers.AbiCoder().encode(["uint8", "bytes"], [Operation.Mint, params]);
        return encodeZeta(trimOx(this.zetaConnectorAddress), Buffer.from(trimOx(message), "hex"), callOptions.revertAddress);
    }
}

const trimOx = (message: string) => {
    if (message.startsWith("0x")) {
        message = message.substring(2);
    }
    return message;
}