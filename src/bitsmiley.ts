import { ethers } from "ethers";

enum Operation {
    OpenVault,
    Mint,
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
     *
     * @param collateralId The collateral id to be used
     * @param bitusd The amount of bitusd to mint
     * @param ownerAddress The owner address of the vault creating
     * @param signature The signature that proves the caller owns the "ownerAddress"
     */
    public openVault(collateralId: string, bitusd: string, ownerAddress: string, signature: string): string {
        const params = new ethers.AbiCoder().encode(
            ["bytes32", "address", "int256", "bytes"], 
            [collateralId, ownerAddress, ethers.parseEther(bitusd), signature]
        );

        let message = new ethers.AbiCoder().encode(["uint8", "bytes"], [Operation.OpenVault, params]);

        return trimOx(this.zetaConnectorAddress) + trimOx(message);
    }

    /**
     * Generates the calldata for minting bitusd
     * 
     * @param ownerAddress The owner address of the vault creating
     * @param bitusd The amount of bitusd to mint
     * @param signature The signature that proves the caller owns the "ownerAddress"
     */
    public mint(ownerAddress: string, bitusd: string, signature: string): string {
        const params = new ethers.AbiCoder().encode(
            ["address", "int256", "bytes"], 
            [ownerAddress, ethers.parseEther(bitusd), signature]
        );

        let message = new ethers.AbiCoder().encode(["uint8", "bytes"], [Operation.Mint, params]);

        return trimOx(this.zetaConnectorAddress) + trimOx(message);
    }
}

const trimOx = (message: string) => {
    if (message.startsWith("0x")) {
        message = message.substring(2);
    }
    return message;
}