export function acceptMetamaskAccessRequest() {
  cy.wait(1000);
  cy.window()
    .then((win) => {
      return !win.ethereum ? [] : win.ethereum.request({ method: 'eth_accounts' });
    })
    .then((accounts) => {
      if (!accounts.length) {
        cy.acceptMetamaskAccess();
      }
    });
}

export function confirmMetamaskTransaction() {
  cy.wait(1000);
  cy.confirmMetamaskTransaction().then(confirmed => {
    expect(confirmed).to.be.true;
  });
}

export function etherscanWaitForTxSuccess(txid) {
  return cy.etherscanWaitForTxSuccess(txid);
}

export function waitUntilLoggedIn() {
  cy.waitUntil(() => {
    const walletAddress = cy.findByTestId('wallet-address');
    return walletAddress.should('exist');
  });
}

export function getLoggedInWalletAddress() {
  const walletAddress = cy.contains('0x');
  return walletAddress.invoke('text');
}
