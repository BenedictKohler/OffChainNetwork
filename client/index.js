const Node = require("../network");
const { getAccount, createAddressMapping, deleteAddressMapping, updateAccount, getCommitments } = require('../database');
const mysql = require('sync-mysql');
const { getPossibleNextHops, createGraph } = require("../utils/network");

const dbConnection = new mysql({
  host: 'localhost',
  user: 'root',
  password: 'Tennisgolf@1',
  database: 'blockchain'
});

const ip = '0.0.0.0';
const port = Number(process.argv[2]);
const password = process.argv[3];

if (isNaN(port) || password.length == 0) {
  throw new Error('Error in arguments. Should be "node index.js PORT PASSWORD"');
}

var Account = getAccount(dbConnection, password);
if (!Account) throw new Error('Invalid Password');

const node = Node(dbConnection, Account.address, ip, port);
node.start();
createAddressMapping(dbConnection, Account.address, ip, port);

process.stdin.on('data', (data) => {
  Account = getAccount(dbConnection, password);
  const input = data.toString().trim().split(" ");
  if (input[0] === 'options') displayOptions();
  else if (input[0] === 'account') displayAccount();
  else if (input[0] === 'quit') shutdown(Account.address);
  else if (input[0] === 'connectedPeers') connectedPeers();
  else if (input[0] === 'createChannel') node.createChannel(input[1], Number(input[2]));
  else if (input[0] === 'acceptChannel') node.acceptChannel(input[1], Number(input[2]));
  else if (input[0] === 'createCommitment') {
    if (node.createCommitment(input[1], Number(input[2]))) updateAccount(dbConnection, Account.address, Account.password, Account.balance - Number(input[2]));
  }
  else if (input[0] === 'acceptCommitment') {
    if (node.acceptCommitment(input[1])) updateAccount(dbConnection, Account.address, Account.password, Account.balance + Number(input[2]));
  }
  else if (input[0] === 'displayCommitments') displayCommitments(input[1]);
  else if (input[0] === 'publishCommitment') node.publishCommitment(input[1]);
  else if (input[0] === 'approvePublishedCommitment') node.approveCommitment(input[1]);
  else if (input[0] === 'revokePublishedCommitment') node.revokeCommitment(input[1]);
  else if (input[0] === 'networkGraph') displayNetworkGraph(input[1], input[2], Number(input[3]));
  else if (input[0] === 'nextHops') displayNextHops(input[1], input[2], Number(input[3]));
  else if (input[0] === 'makePayment') node.attemptPayment(input[1], Number(input[2]), Number(input[3]));
});

const displayOptions = () => {
  console.log('\nquit - disconnects the node');
  console.log('account - displays basic account details');
  console.log('connectedPeers - displays connected peers');
  console.log('createChannel ADDRESS AMOUNT - create a channel with a node');
  console.log('acceptChannel ADDRESS AMOUNT - accept the creation of a channel');
  console.log('createCommitment ADDRESS AMOUNT - creates a new commitment transaction');
  console.log('acceptCommitment ADDRESS AMOUNT - accepts a commitment and updates your own record');
  console.log('displayCommitments ADDRESS - displays any commitments you have with this account');
  console.log('publishCommitment COMMITMENTID - publishes this commitment and closes channel if successful');
  console.log('approvePublishedCommitment COMMITMENTID - cooperatively resolves commitment published by peer');
  console.log('revokePublishedCommitment COMMITMENTID - attempt to steal peers funds to penalize them');
  console.log('networkGraph STARTADDRESS ENDADDRESS DEPTH - create and display a graph between addresses');
  console.log('nextHops STARTADDRESS ENDADDRESS DEPTH - get peers from which we can reach desired address');
  console.log('makePayment ADDRESS AMOUNT DEPTH - tries to make a payment utilizing the lightning network\n');
}

const connectedPeers = () => {
  let peers = '';
  for (let address of node.connectedPeers()) peers += address + " ";
  console.log(peers.length == 0 ? 'No connected peers\n' : peers + '\n');
}

const displayAccount = () => {
  console.log(`\nAddress: ${Account.address}`);
  console.log(`Balance: ${Account.balance}`);
  console.log(`Host: ${ip}, Port: ${port}\n`);
}

const displayCommitments = (peerAddress) => {
  const commitments = getCommitments(dbConnection, Account.address, peerAddress);
  if (commitments.length == 0) console.log('You have no commitments with this account!\n');
  for (let commitment of commitments)
    console.log(`Commitment ${commitment.id}\nYour Balance: ${commitment.ownerAmount}, Counterparty Balance ${commitment.counterpartyAmount}\nDate: ${commitment.dateAdded}\n`);
}

const displayNetworkGraph = (startAddress, endAddress, depth) => {
  createGraph(dbConnection, startAddress, endAddress, depth, true);
}

const displayNextHops = (startAddress, endAddress, depth) => {
  const possibleHops = getPossibleNextHops(dbConnection, startAddress, endAddress, depth);
  for (let hop of possibleHops) console.log(hop + ' ');
  console.log();
}

const shutdown = (address) => {
  deleteAddressMapping(dbConnection, address);
  node.stop(() => {
    process.exit();
  });
}