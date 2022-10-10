import { ethers } from 'hardhat';
import {
  blockTimestamp,
  deployAndAirdropTemple,
  mineForwardSeconds,
  NULL_ADDR,
  toAtto,
} from '../helpers';
import { Signer } from 'ethers';
import {
  TempleERC20Token,
  TempleERC20Token__factory,
  Vault,
  Vault__factory,
  Exposure__factory,
  VaultedTemple,
  VaultedTemple__factory,
  AscendZaps,
  AscendZaps__factory,
} from '../../typechain';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe.only('Ascend Zaps', async () => {
  let TEMPLE: TempleERC20Token;
  let vaultedTemple: VaultedTemple;
  let ascendZaps: AscendZaps;

  let owner: Signer;
  let alan: SignerWithAddress;
  let ben: Signer;

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    TEMPLE = await deployAndAirdropTemple(
      owner,
      [owner, alan, ben],
      toAtto(1000)
    );

    const templeExposure = await new Exposure__factory(owner).deploy(
      'temple exposure',
      'TPL-VAULT-EXPOSURE',
      TEMPLE.address
    );

    vaultedTemple = await new VaultedTemple__factory(owner).deploy(
      TEMPLE.address,
      templeExposure.address
    );

    await templeExposure.setLiqidator(vaultedTemple.address);

    ascendZaps = await new AscendZaps__factory(owner).deploy(
      vaultedTemple.address,
      TEMPLE.address
    );

    await TEMPLE.mint(ascendZaps.address, toAtto(1000000));
  });

  it('Only owner can withdraw from contract', async () => {
    const beforeBal = await TEMPLE.balanceOf(await owner.getAddress());
    const expectedBal = beforeBal.add(toAtto(100));

    await ascendZaps.withdraw(
      TEMPLE.address,
      await owner.getAddress(),
      toAtto(100)
    );

    expect(await TEMPLE.balanceOf(await owner.getAddress())).equals(
      expectedBal
    );

    expect(
      ascendZaps
        .connect(alan)
        .withdraw(TEMPLE.address, await alan.getAddress(), toAtto(100))
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
