import { acceptMetamaskAccessRequest, getLoggedInWalletAddress } from '../util';
import { ethers } from 'ethers';

const network = new ethers.providers.JsonRpcProvider();

const FIVE_MINUTES = 300_000;
const TWO_SECONDS = 2_000;

describe('E2E Stake and Claim tests', () => {
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

  function evmFastForward(ms) {
    return new Cypress.Promise((resolve, reject) => {
      network.send('evm_increaseTime', [ms]).then(() => {
        network.send('evm_mine', []).then(() => {
          resolve('done');
        });
      });
    });
  }

  context('Sub-vault 1', () => {
    it(`should stake in SV1`, () => {
      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');
      cy.get('g[id=sun-marker]') // first deposit has one sun marker
        .should('have.length', 1);
    });
  });

  context('Sub-vault 2', () => {
    // before(() => {
    //   cy.wrap(null).then(() => {
    //     return evmFastForward(FIVE_MINUTES).then((res) => expect(res).to.equal('done'));
    //   });
    // });

    it(`should stake in SV2`, () => {
      // second subvault
      const now = new Date();
      cy.clock(now).tick(FIVE_MINUTES);
      // cy.wait(FIVE_MINUTES);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');
      // 2nd deposit has sun marker and a timeline marker
      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 1);
    });
  });

  context('Sub-vault 3', () => {
    // before(() => {
    //   cy.wrap(null).then(() => {
    //     return evmFastForward(FIVE_MINUTES).then((res) => expect(res).to.equal('done'));
    //   });
    // });

    it(`should stake in SV3`, () => {
      // second subvault
      const now = new Date();
      cy.clock(now).tick(FIVE_MINUTES);
      // cy.wait(FIVE_MINUTES);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');
      // 2nd deposit has sun marker and a timeline marker
      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 2);
    });
  });
});
