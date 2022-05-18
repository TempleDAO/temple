import { acceptMetamaskAccessRequest, confirmMetamaskTransaction, getLoggedInWalletAddress } from '../util';

describe('Smoke tests', () => {
  let metamaskWalletAddress;

  before(() => {
    metamaskWalletAddress = cy.fetchMetamaskWalletAddress().then((address) => {
      metamaskWalletAddress = address;
      cy.addMetamaskNetwork({ networkName: 'local', rpcUrl: 'http://127.0.0.1:8545', symbol: 'ETH', chainId: '31337' });
      cy.visit('http://localhost:3000/core/dapp/vaults/temple-1m-vault/summary');
    });
  });

  context('Connect metamask wallet', () => {
    it(`should connect wallet with success`, () => {
      // connectBrowserWallet
      cy.findByText('Connect Wallet').click();
      cy.findByText('MetaMask').click();
      acceptMetamaskAccessRequest();

      // waitUntilLoggedIn();
      cy.waitUntil(() => {
        const walletAddress = cy.contains('0x');
        return walletAddress.should('exist');
      });

      // getLoggedInWalletAddress
      getLoggedInWalletAddress().then((connectedWalletAddress) => {
        const formattedMetamaskWalletAddress =
          metamaskWalletAddress.slice(0, 6) + '...' + metamaskWalletAddress.slice(-4);
        expect(connectedWalletAddress.toLowerCase()).to.equal(formattedMetamaskWalletAddress.toLowerCase());
      });
    });
  });

  context('Stake', () => {
    it(`should navigate to stake`, () => {
      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      const templeInput = cy.findByPlaceholderText('0.00');
      templeInput.type('2112');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 }).then((confirmed) => {
        expect(confirmed).to.be.true;
        cy.wait(10000);
        cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
        cy.contains('Claimable Temple').should('exist');
        cy.contains('2,112').should('exist');
      });
    });
  });
});
