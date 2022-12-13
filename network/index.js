const net = require('net');
const { getOnlinePeers, signCommitmentTransaction, getCommitmentTransaction, getOnlineAccount, getLatestCommitmentTransaction, getTransactionKey, addCommitmentTransaction, getFundingTransaction, addPeer, addTransactionKey, updateFundingTransaction, addFundingTransaction, addCommitmentRevocation, createHTLContract, getSignedHTLContracts, getAccountByAddress, getUnsignedHTLContracts, updateAccount, signHTLContract, getHTLCKey, deleteHTLCKey, createHTLCKey, deleteHTLContract, getHTLContracts, getHTLContract } = require('../database');
const { generateSecret, hashSecret, generateId, verifySecret } = require('../utils/key');
const { getOptimalPeer, getInitialExpirationDuration, getNextExpirationDuration } = require('../utils/network');

module.exports = (dbConnection, address, ip, port) => {

  var connectedPeers = new Map(); // Peers that are online, and that this account has an open channel with
  var messages = new Map(); // Messages from any connected or non connected node

  const server = net.createServer();

  // Fires when a peer has initiated a connection with us
  server.on('connection', (incomingSocket) => {
    incomingSocket.on('data', (data) => {
      const message = data.toString().split(' ');
      messages.set(message[1], { incomingSocket: incomingSocket, message: message });
      // Peer is wanting to create a channel with us
      if (message[0] === 'createChannel') console.log(`createChannel ${message[1]} ${message[2]}\n`);
      else if (message[0] === 'createCommitment') console.log(`createCommitment ${message[1]} ${message[2]}\n`);
      else if (message[0] === 'publishCommitment') console.log(`Commitment Transaction with Id ${message[2]} was published by Account ${message[1]}\n`);
      else if (message[0] === 'initiateMultistepPayment') initiateMultistepPayment(message[1]);
    });
  });

  // If a previously connected peer comes back online then connect to it
  setInterval(() => { syncPeers() }, 30000);

  // Update payment channel commitments when a HTLC signature occurs
  setInterval(() => { checkHTLCSignatures() }, 15000);

  // Forwards HTLC's on if need be
  setInterval(() => { checkNewHTLContracts() }, 10000);

  const checkNewHTLContracts = () => {
    const unsignedHTLContracts = getUnsignedHTLContracts(dbConnection, address);
    for (let htlContract of unsignedHTLContracts) {
      if (htlContract.destinationAddress === address) {
        const htlcKeyObj = getHTLCKey(dbConnection, htlContract.routeId);
        if (htlcKeyObj && htlcKeyObj.amount === htlContract.amount) {
          signHTLContract(dbConnection, htlContract.routeId, address, htlcKeyObj.htlcKey);
          deleteHTLCKey(dbConnection, htlcKeyObj.routeId);
        }
      }
      else {
        // Make sure that we haven't already created the next HTLC in the chain
        const nextHtlContract = getHTLContract(dbConnection, htlContract.routeId, address);
        if (!nextHtlContract) {
          // Get the peer that's part of the route with maximal capacity
          const optimalPeer = getOptimalPeer(dbConnection, address, htlContract.destinationAddress, htlContract.amount, htlContract.hopDepth - 1);
          if (optimalPeer) createHTLContract(dbConnection, address, optimalPeer.address, htlContract.destinationAddress, htlContract.routeId, Math.min(htlContract.amount, optimalPeer.capacity), htlContract.signatureHash, getNextExpirationDuration(htlContract.timelock), htlContract.hopDepth - 1);
        }
      }
    }
  }

  const checkHTLCSignatures = () => {
    const signedHTLContracts = getSignedHTLContracts(dbConnection, address);
    for (let htlContract of signedHTLContracts) {
      if (verifySecret(htlContract.signature, htlContract.signatureHash) && createCommitment(htlContract.counterpartyAddress, htlContract.amount)) {
        // After successfully paying the counterparty we update account balances
        const Account = getAccountByAddress(dbConnection, address);
        const counterpartyAccount = getAccountByAddress(dbConnection, htlContract.counterpartyAddress);
        updateAccount(dbConnection, address, Account.password, Account.balance - htlContract.amount);
        updateAccount(dbConnection, counterpartyAccount.address, counterpartyAccount.password, counterpartyAccount.balance + htlContract.amount);
        // We now sign the previous HTLC in the chain so that we can be compensated (this will do nothing in the case that we're the Account initiating the payment)
        signHTLContract(dbConnection, htlContract.routeId, address, htlContract.signature);
        deleteHTLContract(dbConnection, htlContract.routeId, address, htlContract.counterpartyAddress);
      }
    }
  }

  // Checks if previous peers have rejoined the network
  const syncPeers = () => {
    const onlinePeers = getOnlinePeers(dbConnection, address);
    connectedPeers.clear();
    for (let peer of onlinePeers) connectedPeers.set(peer.address, { ip: peer.ip, port: peer.port });
  }

  const initiateMultistepPayment = (peerAddress) => {
    const { incomingSocket, message } = messages.get(peerAddress);
    messages.delete(peerAddress);
    const htlcKey = generateSecret(16);
    const signatureHash = hashSecret(htlcKey);
    incomingSocket.write(`signatureHash ${signatureHash}`);
    createHTLCKey(dbConnection, message[3], address, Number(message[2]), htlcKey);
    incomingSocket.destroy();
  }

  const acceptChannel = (peerAddress, amount) => {
    const { incomingSocket, message } = messages.get(peerAddress);
    messages.delete(peerAddress);
    const counterpartyAmount = Number(message[2]);
    const counterpartyPublicKey = message[3];
    const theirCommitmentId = message[4];
    const myCommitmentId = generateId(8);
    const privateKey = generateSecret(16);
    const publicKey = hashSecret(privateKey);
    createFundingTransaction(address, peerAddress, amount, privateKey, publicKey, message[3], false);
    incomingSocket.write(`acceptChannel ${address} ${amount} ${publicKey} ${myCommitmentId}`);
    createCommitmentTransaction(myCommitmentId, address, peerAddress, amount, counterpartyAmount, counterpartyPublicKey);
    addTransactionKey(dbConnection, theirCommitmentId, 'private', privateKey, address);
    console.log(`\nChannel created: You ${amount}, ${peerAddress} ${counterpartyAmount}\n`);
    incomingSocket.destroy();
  }

  // Try to create a payment channel with an account with address 'peerAddress'
  const createChannel = (peerAddress, amount) => {
    // Make sure that a payment channel doesn't already exist
    if (connectedPeers.has(peerAddress)) {
      console.log('A payment channel with this peer already exists!\n');
      return;
    }
    // Make sure that the account is online and active
    const onlineAccount = getOnlineAccount(dbConnection, peerAddress);
    if (!onlineAccount) {
      console.log('The account is currently not online or doesn\'t exist!\n');
      return;
    }
    try {
      const outgoingSocket = createConnection(onlineAccount);
      const myCommitmentId = generateId(8);
      const privateKey = generateSecret(16); // Only this account is privy to this private key
      const publicKey = hashSecret(privateKey); // Counterparty uses this as signature for commitment transaction
      outgoingSocket.on('connect', () => {
        outgoingSocket.write(`createChannel ${address} ${amount} ${publicKey} ${myCommitmentId}`); // Try to create a channel with an account
      });
      outgoingSocket.on('data', (data) => {
        const message = data.toString().split(' ');
        if (message[0] === 'acceptChannel') {
          const counterpartyAmount = Number(message[2]);
          const counterpartyPublicKey = message[3];
          const theirCommitmentId = message[4];
          createFundingTransaction(address, peerAddress, amount, privateKey, publicKey, counterpartyPublicKey, true);
          createCommitmentTransaction(myCommitmentId, address, peerAddress, amount, counterpartyAmount, counterpartyPublicKey);
          addTransactionKey(dbConnection, theirCommitmentId, 'private', privateKey, address);
          addPeer(dbConnection, address, peerAddress);
          console.log(`\nChannel created: You ${amount}, ${peerAddress} ${counterpartyAmount}\n`);
          outgoingSocket.destroy();
        }
        else {
          outgoingSocket.destroy();
          console.log(`\nFailed to communicate with the account ${peerAddress}\n`);
        }
      });
    }
    catch (err) {
      console.log(err);
    }
  }

  const acceptCommitment = (peerAddress) => {
    const { incomingSocket, message } = messages.get(peerAddress);
    messages.delete(peerAddress);
    const counterpartyAmount = Number(message[2]);
    const counterpartyPublicKey = message[3];
    const previousCounterpartyCommitmentId = message[4];
    const counterpartyRevocationKey = message[5];
    const theirCommitmentId = message[6];
    const myCommitmentId = generateId(8);
    const privateKey = generateSecret(16);
    const publicKey = hashSecret(privateKey);
    // Get private key associated with previous commitment so peer can use as revocation key
    const commitmentTransaction = getLatestCommitmentTransaction(dbConnection, address, peerAddress);
    const revocationKey = getTransactionKey(dbConnection, commitmentTransaction.id, 'private', address)?.transactionKey;
    incomingSocket.write(`acceptCommitment ${address} ${publicKey} ${commitmentTransaction.id} ${revocationKey} ${myCommitmentId}`);
    const yourNewBalance = commitmentTransaction.ownerAmount + counterpartyAmount;
    const counterpartyNewBalance = commitmentTransaction.counterpartyAmount - counterpartyAmount;
    createCommitmentTransaction(myCommitmentId, address, peerAddress, yourNewBalance, counterpartyNewBalance, counterpartyPublicKey);
    addTransactionKey(dbConnection, previousCounterpartyCommitmentId, 'revocation', counterpartyRevocationKey, address);
    addTransactionKey(dbConnection, theirCommitmentId, 'private', privateKey, address);
    console.log(`\nNew Commitment: You ${yourNewBalance}, ${peerAddress} ${counterpartyNewBalance}\n`);
    incomingSocket.destroy();
    return true;
  }

  const createCommitment = (peerAddress, amount) => {
    // Make sure that the account is online and active
    const onlineAccount = getOnlineAccount(dbConnection, peerAddress);
    if (!onlineAccount) {
      console.log('The account is currently not online or doesn\'t exist!\n');
      return false;
    }
    // Make sure that a payment channel exists
    if (!connectedPeers.has(peerAddress)) {
      console.log('You do not have a payment channel established with this account!\n');
      return false;
    }
    // Get private key associated with previous commitment so peer can use as revocation key
    const commitmentTransaction = getLatestCommitmentTransaction(dbConnection, address, peerAddress);
    const revocationKey = getTransactionKey(dbConnection, commitmentTransaction.id, 'private', address)?.transactionKey;
    try {
      const outgoingSocket = createConnection(onlineAccount);
      const myCommitmentId = generateId(8);
      const privateKey = generateSecret(16); // Only this account is privy to this private key
      const publicKey = hashSecret(privateKey); // Counterparty uses this as signature for commitment transaction
      outgoingSocket.on('connect', () => {
        outgoingSocket.write(`createCommitment ${address} ${amount} ${publicKey} ${commitmentTransaction.id} ${revocationKey} ${myCommitmentId}`);
      });
      outgoingSocket.on('data', (data) => {
        const message = data.toString().split(' ');
        if (message[0] === 'acceptCommitment') {
          const counterpartyPublicKey = message[2];
          const previousCounterpartyCommitmentId = message[3];
          const counterpartyRevocationKey = message[4];
          const theirCommitmentId = message[5];
          const yourNewBalance = commitmentTransaction.ownerAmount - amount;
          const counterpartyNewBalance = commitmentTransaction.counterpartyAmount + amount;
          createCommitmentTransaction(myCommitmentId, address, peerAddress, yourNewBalance, counterpartyNewBalance, counterpartyPublicKey);
          addTransactionKey(dbConnection, previousCounterpartyCommitmentId, 'revocation', counterpartyRevocationKey, address);
          addTransactionKey(dbConnection, theirCommitmentId, 'private', privateKey, address);
          console.log(`\nNew Commitment: You ${yourNewBalance}, ${peerAddress} ${counterpartyNewBalance}\n`);
          outgoingSocket.destroy();
        }
        else {
          outgoingSocket.destroy();
          console.log(`\nFailed to communicate with the account ${peerAddress}\n`);
          return false;
        }
      });
    }
    catch (err) {
      console.log(err);
      return false;
    }
    return true;
  }

  const publishCommitment = (commitmentId) => {
    const commitment = getCommitmentTransaction(dbConnection, commitmentId);
    if (!commitment) {
      console.log('No such commitment transaction exists!\n');
      return;
    }
    const privateKey = getTransactionKey(dbConnection, commitmentId, 'private', commitment.ownerAddress)?.transactionKey;
    signCommitmentTransaction(dbConnection, commitmentId, privateKey, true);
    const onlineAccount = getOnlineAccount(dbConnection, commitment.counterpartyAddress);
    if (!onlineAccount) {
      console.log('Peer is not online so will have to resolve non-cooperatively for the time being!\n');
      return;
    }
    const outgoingSocket = createConnection(onlineAccount);
    outgoingSocket.on('connect', () => {
      outgoingSocket.write(`publishCommitment ${commitment.ownerAddress} ${commitmentId}`);
      console.log('Notified peer of published commitment. Attempting to resolve cooperatively!\n');
      outgoingSocket.destroy();
    });
  }

  const approveCommitment = (commitmentId) => {
    const commitment = getCommitmentTransaction(dbConnection, commitmentId);
    if (!commitment) {
      console.log('Commitment transaction has already been added to the chain!\n');
      return;
    }
    messages.delete(commitment.ownerAddress);
    const privateKey = getTransactionKey(dbConnection, commitmentId, 'private', address)?.transactionKey;
    signCommitmentTransaction(dbConnection, commitmentId, privateKey, false);
    console.log('Cooperatively closing the channel. Funds should appear in your account shortly!\n');
  }

  const revokeCommitment = (commitmentId) => {
    const commitment = getCommitmentTransaction(dbConnection, commitmentId);
    if (!commitment) {
      console.log('Revocation time period expired. Commitment already added to the chain!\n');
      return;
    }
    messages.delete(commitment.ownerAddress);
    const revocationKey = getTransactionKey(dbConnection, commitmentId, 'revocation', address)?.transactionKey;
    const privateKey = getTransactionKey(dbConnection, commitmentId, 'private', address)?.transactionKey;
    if (!revocationKey || !privateKey) {
      console.log('You do not hold the keys to revoke this commitment transaction!\n');
      return;
    }
    addCommitmentRevocation(dbConnection, commitmentId, revocationKey, privateKey, address);
    console.log('Revoking the published commitment transaction. Funds should appear in your account shortly!\n');
  }

  const createFundingTransaction = (address1, address2, amount, privateKey, publicKey, counterpartyPublicKey, initiator) => {
    // This should be atomic as the peer is performing a similar transaction
    const fundingTransaction = initiator ? getFundingTransaction(dbConnection, address1, address2) : getFundingTransaction(dbConnection, address2, address1);
    const id = fundingTransaction ? fundingTransaction.id : generateId(8);
    if (initiator) {
      fundingTransaction ? updateFundingTransaction(dbConnection, `${address1} ${amount}`, id, true) :
        addFundingTransaction(dbConnection, `${address1} ${amount}`, `${publicKey} ${counterpartyPublicKey}`, id, true);
    }
    else {
      fundingTransaction ? updateFundingTransaction(dbConnection, `${address1} ${amount}`, id, false) :
        addFundingTransaction(dbConnection, `${address1} ${amount}`, `${counterpartyPublicKey} ${publicKey}`, id, false);
    }
    addTransactionKey(dbConnection, id, 'private', privateKey, address1);
    addTransactionKey(dbConnection, id, 'public', counterpartyPublicKey, address1);
  }

  const createCommitmentTransaction = (id, ownerAddress, counterpartyAddress, ownerAmount, counterpartyAmount, counterpartySignature) => {
    const privateKey = generateSecret(16);
    const publicKey = hashSecret(privateKey);
    addCommitmentTransaction(dbConnection, id, ownerAddress, counterpartyAddress, ownerAmount, counterpartyAmount, '', counterpartySignature, `${publicKey} ${counterpartySignature}`);
    addTransactionKey(dbConnection, id, 'private', privateKey, ownerAddress);
    addTransactionKey(dbConnection, id, 'public', counterpartySignature, ownerAddress);
  }

  const attemptPayment = (destinationAddress, amount, depth) => {
    // Check whether there exists a direct payment channel already
    const latestCommitment = getLatestCommitmentTransaction(dbConnection, address, destinationAddress);
    if (latestCommitment && amount <= latestCommitment.ownerAmount) {
      console.log(`Please pay ${destinationAddress} directly using createCommitment since a sufficient channel already exists!\n`);
      return;
    }
    // Get the peer that's part of the route with maximal capacity
    const optimalPeer = getOptimalPeer(dbConnection, address, destinationAddress, amount, depth);
    if (!optimalPeer) {
      console.log(`There does not exist a valid payment route to ${destinationAddress}! Consider making a direct channel.\n`);
      return;
    }
    if (amount > optimalPeer.capacity) console.log(`Attempting to process a payment of size ${optimalPeer.capacity} since ${amount} is too large!\n`);
    else console.log(`Making payment of amount ${amount} to ${destinationAddress}.\n`);
    // Get the signature hash from the account you're wanting to pay
    const onlineAccount = getOnlineAccount(dbConnection, destinationAddress);
    if (!onlineAccount) {
      console.log(`The account ${destinationAddress} is offline so can't initiate the multistep transaction!\n`);
      return;
    }
    try {
      const outgoingSocket = createConnection(onlineAccount);
      const routeId = generateId(8);
      outgoingSocket.on('connect', () => {
        outgoingSocket.write(`initiateMultistepPayment ${address} ${amount} ${routeId}`);
      });
      outgoingSocket.on('data', (data) => {
        const message = data.toString().split(' ');
        if (message[0] === 'signatureHash') {
          createHTLContract(dbConnection, address, optimalPeer.address, destinationAddress, routeId, amount, message[1], getInitialExpirationDuration(depth), depth);
          outgoingSocket.destroy();
        }
        else {
          outgoingSocket.destroy();
          console.log(`Failed to communicate with the account ${destinationAddress}\n`);
          return;
        }
      });
    }
    catch (err) {
      console.log(err);
      return;
    }
  }

  // Creates a connection in order to exchange data with an account
  const createConnection = (account) => {
    const outgoingSocket = new net.Socket();
    outgoingSocket.connect({ port: account.port, host: account.ip });
    return outgoingSocket;
  }

  const start = () => {
    server.listen(port, ip);
  }

  const stop = (cbFunction) => {
    server.close(cbFunction());
  }

  return {
    connectedPeers: () => connectedPeers.keys(),
    start, stop, createChannel, acceptChannel,
    createCommitment, acceptCommitment, publishCommitment,
    approveCommitment, revokeCommitment, attemptPayment
  };
};

/* Explanation of Transaction Keys: 
The 3 key types are private, public, and revocation
When an account creates a new commitment the following happens
  - Generates a private key that only he has access to
  - Derives a public key from this private key and sends it to counterparty as his signature
  - Stores this private key with the id of the counterparties commitment transaction
  - Gets given a public key from counterparty to use as signature but does not know the private key
  - Creates a new private key for his own commitment transaction. Stores it, but hashes it to create output signature
  - This private key must be different from previous private key as it later becomes a revocation key for the counterparty
  - Counterparty can use this revocation key in conjunction with their first private key mentioned to prevent a user from
    publishing an outdated commitment transaction that is more favorable.
*/