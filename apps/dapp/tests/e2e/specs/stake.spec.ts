import { acceptMetamaskAccessRequest, getLoggedInWalletAddress } from '../util';
import { ethers } from 'ethers';

const network = new ethers.providers.JsonRpcProvider();

const ONE_MINUTE = 60_000;

const metamaskTxnTime = 20_000;

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
    it(`should stake in Subvault 1`, () => {
      cy.get('g[id="marker"]')
        .children('animateTransform')
        .invoke('attr', 'to')
        .then((to) => {
          // TO gives us the relative progress of the marker along its path
          // From this we can decide how long to wait until we start staking/deposits
          // to issues with the stake window being too short
          const position = Number(to.substring(0, 2));
          cy.log(`Position: ${position.toString()}`);

          const MAX = 85;
          const MIN = 53;

          const percentRemaining = (position - MIN) / (MAX - MIN);
          cy.log(`Percent remaining: ${percentRemaining.toString()}`);

          if (percentRemaining < 0.8) {
            // wait for the next "cycle" if we won't have enough time to finish all the txns
            cy.wait(ONE_MINUTE * percentRemaining + 10000);
          }
        });

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
    it(`should stake in Subvault 2`, () => {
      cy.wait(ONE_MINUTE - metamaskTxnTime);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');

      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 1);
    });
  });

  context('Sub-vault 3', () => {
    it(`should stake in Subvault 3`, () => {
      cy.wait(ONE_MINUTE - metamaskTxnTime);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');

      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 2);
    });
  });

  context('Sub-vault 4', () => {
    it(`should stake in Subvault 4`, () => {
      cy.wait(ONE_MINUTE - metamaskTxnTime);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');

      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 3);
    });
  });

  context('Sub-vault 5', () => {
    it(`should stake in Subvault 5`, () => {
      cy.wait(ONE_MINUTE - metamaskTxnTime);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');

      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 4);
    });
  });

  context('Sub-vault 6', () => {
    it(`should stake in Subvault 6`, () => {
      cy.wait(ONE_MINUTE - metamaskTxnTime);

      cy.get('path[id="stake-button-target"]').trigger('click', { force: true });
      cy.findByPlaceholderText('0.00').type('1000');

      cy.contains('button', 'Approve').click();
      cy.confirmMetamaskPermissionToSpend();

      cy.contains('button', 'Stake').click();
      cy.confirmMetamaskTransaction({ gasFee: 10000, gasLimit: 1000000 });

      cy.get('path[id="claim-button-target"]').trigger('click', { force: true });
      cy.contains('Claimable Temple').should('exist');
      cy.contains('1,000').should('exist');

      cy.get('g[id=sun-marker]').should('have.length', 1);
      cy.get('g[id=deposited-timeline-marker]').should('have.length', 5);
    });
  });
});
