import { network } from 'hardhat';

export const impersonateAccount = async (account: string) => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [account],
  });
};
