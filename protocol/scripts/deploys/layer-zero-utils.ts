import { ILayerZeroEndpointV2__factory, TempleGold, TempleGold__factory } from "../../typechain";
import { mine } from "./helpers";
import { ethers, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { network } from 'hardhat';

const EXECUTOR_CONFIG_TYPE = 1;
const ULN_CONFIG_TYPE = 2;

export async function reportDvns(owner: SignerWithAddress, oftAddress: string, destEid: number) {
  const oft = TempleGold__factory.connect(oftAddress, owner);
  console.log('chain:', network.name);
  console.log('OFT:', oft.address);
  console.log('destEid:', destEid);

  const endpointAddr = await oft.endpoint();
  console.log('lz endpoint:', endpointAddr);
  const endpoint = ILayerZeroEndpointV2__factory.connect(endpointAddr, owner);
  const sendLib = await endpoint.getSendLibrary(oft.address, destEid);
  const receiveLib = await endpoint.getReceiveLibrary(oft.address, destEid);

  console.log('sendLib:', sendLib);
  console.log('receiveLib:', receiveLib.lib, 'isDefault:', receiveLib.isDefault);

  console.log('--------SEND LIB-------');

  // show send config:
  try {
    console.log('EXEC:');
    const configExecRaw = await endpoint.getConfig(
      oft.address,
      sendLib,
      destEid,
      EXECUTOR_CONFIG_TYPE,
    );
    const configExec = utils.defaultAbiCoder.decode(
        ['tuple(uint32 maxMessageSize,address executor)'],
        configExecRaw
      )[0];
    console.log({
      maxMessageSize: configExec.maxMessageSize,
      executor: configExec.executor,
    });

    console.log('ULN:');
    const configUlnRaw = await endpoint.getConfig(
      oft.address,
      sendLib,
      destEid,
      ULN_CONFIG_TYPE,
    );
    const configUln = utils.defaultAbiCoder.decode(
      [
        'tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs)',
      ],
      configUlnRaw
    )[0];
    console.log({
      confirmations: configUln.confirmations.toString(),
      requiredDVNCount: configUln.requiredDVNCount,
      optionalDVNCount: configUln.optionalDVNCount,
      optionalDVNThreshold: configUln.optionalDVNThreshold,
      requiredDVNs: configUln.requiredDVNs,
      optionalDVNs: configUln.optionalDVNs
    });
  } catch (e) {
    console.log('WARNING: not configured');
    console.warn(e);
  }


  console.log('--------RECEIVE LIB-------');
  try {
    // show send config:
    console.log('ULN:');
    const configUlnRaw = await endpoint.getConfig(
      oft.address,
      receiveLib.lib,
      destEid,
      ULN_CONFIG_TYPE,
    );
    const configUln = utils.defaultAbiCoder.decode(
      [
        'tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs)',
      ],
      configUlnRaw
    )[0];
    console.log({
      confirmations: configUln.confirmations.toString(),
      requiredDVNCount: configUln.requiredDVNCount,
      optionalDVNCount: configUln.optionalDVNCount,
      optionalDVNThreshold: configUln.optionalDVNThreshold,
      requiredDVNs: configUln.requiredDVNs,
      optionalDVNs: configUln.optionalDVNs
    });
  } catch (e) {
    console.log('WARNING: not configured');
    console.warn(e);
  }
}

export async function setPeer(srcOft: TempleGold, destEid: number, destOftAddress: string) {
  console.log(`${srcOft.address}.setPeer(${destEid}, "${ethers.utils.hexlify(ethers.utils.zeroPad(destOftAddress, 32))}")`);
  // await mine(srcOft.setPeer(Expand commentComment on line R104Resolved
  //   destEid,
  //   ethers.utils.zeroPad(destOftAddress, 32)
  // ));
}

export async function setDvnConfig(
  owner: SignerWithAddress,
  oftAddress: string,
  destEid: number,
  config: {
    confirmations: number;
    requiredDVNCount: number;
    optionalDVNCount: number;
    optionalDVNThreshold: number;
    requiredDVNs: string[];
    optionalDVNs: string[];
  }
) {
  await reportDvns(owner, oftAddress, destEid);

  const oft = TempleGold__factory.connect(oftAddress, owner);
  const endpointAddr = await oft.endpoint();
  const endpoint = ILayerZeroEndpointV2__factory.connect(endpointAddr, owner);
  const sendLib = await endpoint.getSendLibrary(oft.address, destEid);
  const receiveLib = await endpoint.getReceiveLibrary(oft.address, destEid);

  const configUln = utils.defaultAbiCoder.encode(
    [
      'tuple(uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs)',
    ],
    [{...config}]
  );
  console.log(`${endpoint.address}.setConfig(${oftAddress}, ${sendLib}, [[${destEid},${ULN_CONFIG_TYPE},"${configUln}"]])\n`);
  console.log(`${endpoint.address}.setConfig(${oftAddress}, ${receiveLib.lib}, [[${destEid},${ULN_CONFIG_TYPE},"${configUln}"]])`);

  // await mine(endpoint.setConfig(oftAddress, sendLib, [
  //   {
  //     eid: destEid,
  //     configType: ULN_CONFIG_TYPE,
  //     config: configUln
  //   },
  // ]));
  // await mine(endpoint.setConfig(oftAddress, receiveLib.lib, [
  //   {
  //     eid: destEid,
  //     configType: ULN_CONFIG_TYPE,
  //     config: configUln
  //   },
  // ]));

  // await reportDvns(owner, oftAddress, destEid);
}