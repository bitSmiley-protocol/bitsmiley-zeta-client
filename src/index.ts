export * from './client';
export * from './bitsmiley';

// import { BitSmileyCalldataGenerator } from './bitsmiley';
// import { ZetaBtcClient } from './client';

// function main() {
//     const client = new BitSmileyCalldataGenerator("0xE869b85987D86d8fBb8913f97A705B4741edE86E");
//     const memo = client.openVault(
//         {
//             revertAddress: "tb1pl4wr89n8rtwggxefcsjc0acvly2qxj6a95ht8gzk78mcpa7kjyrsdxnguy",
//         },
//         {
//             collateralId: '0x1f0872ad59671c20d8c7df17da90b261e3c61dce471fb1de3ac739641a4380af',
//             bitusd: '10',
//             ownerAddress: '0x65a45c57636f9BcCeD4fe193A602008578BcA90b',
//             signature: '0x00'
//         }
//     );
    
//     const calldata = Buffer.from(memo, "hex");

//     const deposit = 200000;
//     const feeRate = 1600;

//     let zetaClient = ZetaBtcClient.testnet();
//     const fee = zetaClient.estimateRevealTxnFee(calldata, deposit, feeRate);
//     const total = deposit + fee;

//     zetaClient = ZetaBtcClient.testnet();
//     const address = zetaClient.call(calldata);
//     zetaClient.buildRevealTxn(address, );
// }

// main();
