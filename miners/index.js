const { getFundingTransactions, deleteFundingTransaction, addTransactionToChain, getCommitmentRevocations, getCommitmentTransaction, incrementAccountBalance, deleteCommitmentTransactions, deleteCommitmentRevocation, getPublishedCommitments, deleteTransactionKeys, deletePeer } = require('../database');
const mysql = require('sync-mysql');
const { generateId, verifySecret } = require('../utils/key');

const TIMELOCK_IN_SECONDS = 60;

const dbConnection = new mysql({
  host: 'localhost',
  user: 'root',
  password: 'Tennisgolf@1',
  database: 'blockchain'
});

setInterval(() => { processFundingTransactions() }, 30000);
setInterval(() => { processPublishedCommitments() }, 20000);

const processFundingTransactions = () => {
    const pendingFundingTransactions = getFundingTransactions(dbConnection);
    for (let fundingTransaction of pendingFundingTransactions) {
        const input1 = fundingTransaction.input1.split(' ');
        const input2 = fundingTransaction.input2.split(' ');
        addTransactionToChain(dbConnection, fundingTransaction.id, `${input1[0]} ${input2[0]}`, Number(input1[1]) + Number(input2[1]), fundingTransaction.output);
        deleteFundingTransaction(dbConnection, fundingTransaction.id);
    }
}

const processPublishedCommitments = () => {
  const revocations = getCommitmentRevocations(dbConnection);
  for (let revocation of revocations) processRevocation(revocation);
  const commitments = getPublishedCommitments(dbConnection);
  const currTime = Math.round(Date.now() / 1000);
  for (let commitment of commitments) {
    const outputs = commitment.output.split(' ');
    if (verifySecret(commitment.ownerSignature, outputs[0]) && verifySecret(commitment.counterpartySignature, outputs[1])) {
      processCommitment(commitment);
    }
    else if (verifySecret(commitment.ownerSignature, outputs[0]) && commitment.counterpartySignature === outputs[1]) {
      if (currTime - Number(commitment.datePublished) > TIMELOCK_IN_SECONDS) processCommitment(commitment);
    }
  }
}

const processCommitment = (commitment) => {
  const transactionId = generateId(8);
  addTransactionToChain(dbConnection, transactionId, `${commitment.ownerAddress} ${commitment.counterpartyAddress}`, Number(commitment.ownerAmount), commitment.output);
  addTransactionToChain(dbConnection, transactionId, `${commitment.counterpartyAddress} ${commitment.ownerAddress}`, Number(commitment.counterpartyAmount), commitment.output);
  deleteCommitmentTransactions(dbConnection, commitment.ownerAddress, commitment.counterpartyAddress);
  deleteTransactionKeys(dbConnection, commitment.ownerAddress, commitment.counterpartyAddress);
  deletePeer(dbConnection, commitment.ownerAddress, commitment.counterpartyAddress);
}

const processRevocation = (revocation) => {
  const publishedCommitment = getCommitmentTransaction(dbConnection, revocation.commitmentId);
  const outputs = publishedCommitment?.output.split(' ');
  if (verifySecret(revocation.revocationKey, outputs[0]) && verifySecret(revocation.privateKey, outputs[1])) {
    const transactionId = generateId(8);
    addTransactionToChain(dbConnection, transactionId, `${publishedCommitment.counterpartyAddress} ${publishedCommitment.ownerAddress}`, Number(publishedCommitment.ownerAmount) + Number(publishedCommitment.counterpartyAmount), publishedCommitment.output);
    addTransactionToChain(dbConnection, transactionId, `${publishedCommitment.ownerAddress} ${publishedCommitment.counterpartyAddress}`, 0, publishedCommitment.output);
    incrementAccountBalance(dbConnection, publishedCommitment.ownerAddress, -Number(publishedCommitment.ownerAmount));
    incrementAccountBalance(dbConnection, publishedCommitment.counterpartyAddress, Number(publishedCommitment.ownerAmount));
    deleteCommitmentTransactions(dbConnection, publishedCommitment.ownerAddress, publishedCommitment.counterpartyAddress);
    deleteTransactionKeys(dbConnection, publishedCommitment.ownerAddress, publishedCommitment.counterpartyAddress);
    deletePeer(dbConnection, publishedCommitment.ownerAddress, publishedCommitment.counterpartyAddress);
  }
  deleteCommitmentRevocation(dbConnection, revocation.commitmentId);
}