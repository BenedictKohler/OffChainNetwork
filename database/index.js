const getAccount = (connection, password) => {
    return connection.query('select address, password, balance from Account where password = ?', [password])[0];
};

const getPeers = (connection, address) => {
    return connection.query('select address1 as address from Peer where address2 = ? union select address2 as address from Peer where address1 = ?', [address, address]);
}

const getOnlinePeers = (connection, address) => {
    return connection.query('select address, ip, port from AddressMapping where address in (select address1 as address from Peer where address2 = ? union select address2 as address from Peer where address1 = ?)', [address, address]);
}

const getOnlineAccount = (connection, address) => {
    return connection.query('select address, ip, port from AddressMapping where address = ?', [address])[0];
}

const createAddressMapping = (connection, address, ip, port) => {
    return connection.query('insert into AddressMapping (address, ip, port) values (?, ?, ?)', [address, ip, port]);
}

const deleteAddressMapping = (connection, address) => {
    return connection.query('delete from AddressMapping where address = ?', [address]);
}

const getFundingTransaction = (connection, address1, address2) => {
    return connection.query('select id, input1, input2, output from FundingTransaction where input1 like ? or input2 like ?', [`${address1}%`, `${address2}%`])[0];
}

const updateFundingTransaction = (connection, input, id, firstInput) => {
    if (firstInput) return connection.query('update FundingTransaction set input1 = ? where id = ?', [input, id]);
    else return connection.query('update FundingTransaction set input2 = ? where id = ?', [input, id]);
}

const addFundingTransaction = (connection, input, output, id, firstInput) => {
    if (firstInput) return connection.query('insert into FundingTransaction (input1, input2, output, id) values (?, ?, ?, ?)', [input, null, output, id]);
    else return connection.query('insert into FundingTransaction (input1, input2, output, id) values (?, ?, ?, ?)', [null, input, output, id]);
}

const addTransactionKey = (connection, id, keyType, key, ownerAddress) => {
    return connection.query('insert into TransactionKey (transactionId, keyType, transactionKey, ownerAddress) values (?, ?, ?, ?)', [id, keyType, key, ownerAddress]);
}

const addCommitmentTransaction = (connection, id, ownerAddress, counterpartyAddress, ownerAmount, counterpartyAmount, ownerSignature, counterpartySignature, output) => {
    return connection.query('insert into CommitmentTransaction (id, ownerAddress, counterpartyAddress, ownerAmount, counterpartyAmount, ownerSignature, counterpartySignature, output) values (?, ?, ?, ?, ?, ?, ?, ?)', [id, ownerAddress, counterpartyAddress, ownerAmount, counterpartyAmount, ownerSignature, counterpartySignature, output]);
}

const addPeer = (connection, address1, address2) => {
    return connection.query('insert into Peer (address1, address2) values (?, ?)', [address1, address2]);
}

const getFundingTransactions = (connection) => {
    return connection.query('select input1, input2, output, id from FundingTransaction');
}

const deletePeer = (connection, address1, address2) => {
    connection.query('delete from Peer where (address1 = ? and address2 = ?) or (address1 = ? and address2 = ?)', [address1, address2, address2, address1]);
}

const addTransactionToChain = (connection, id, input, amount, output) => {
    return connection.query('insert into Transaction (id, input, amount, output) values (?, ?, ?, ?)', [id, input, amount, output]);
}

const deleteFundingTransaction = (connection, id) => {
    return connection.query('delete from FundingTransaction where id = ?', [id]);
}

const getLatestCommitmentTransaction = (connection, ownerAddress, counterpartyAddress) => {
    return connection.query('select * from CommitmentTransaction where ownerAddress = ? and counterpartyAddress = ? order by dateAdded desc limit 1', [ownerAddress, counterpartyAddress])[0];
}

const getTransactionKey = (connection, transactionId, keyType, ownerAddress) => {
    return connection.query('select * from TransactionKey where transactionId = ? and keyType = ? and ownerAddress = ?', [transactionId, keyType, ownerAddress])[0];
}

const updateAccount = (connection, address, password, balance) => {
    return connection.query('update Account set address = ?, password = ?, balance = ? where address = ?', [address, password, balance, address]);
}

const incrementAccountBalance = (connection, address, amount) => {
    return connection.query('update Account set balance = balance + ? where address = ?', [amount, address]);
}

const getCommitments = (connection, ownerAddress, counterpartyAddress) => {
    return connection.query('select * from CommitmentTransaction where ownerAddress = ? and counterpartyAddress = ? order by dateAdded asc', [ownerAddress, counterpartyAddress]);
}

const getCommitmentTransaction = (connection, id) => {
    return connection.query('select * from CommitmentTransaction where id = ?', [id])[0];
}

const signCommitmentTransaction = (connection, id, signature, isOwner) => {
    const currTime = Math.round(Date.now() / 1000);
    if (isOwner) return connection.query('update CommitmentTransaction set ownerSignature = ?, datePublished = ? where id = ?', [signature, currTime, id]);
    else return connection.query('update CommitmentTransaction set counterpartySignature = ?, datePublished = ? where id = ?', [signature, currTime, id]);
}

const addCommitmentRevocation = (connection, commitmentId, revocationKey, privateKey, address) => {
    return connection.query('insert into CommitmentRevocation (commitmentId, revocationKey, privateKey, address) values (?, ?, ?, ?)', [commitmentId, revocationKey, privateKey, address]);
}

const getCommitmentRevocations = (connection) => {
    return connection.query('select * from CommitmentRevocation');
}

const deleteCommitmentTransactions = (connection, address1, address2) => {
    return connection.query('delete from CommitmentTransaction where (ownerAddress = ? and counterpartyAddress = ?) or (ownerAddress = ? and counterpartyAddress = ?)', [address1, address2, address2, address1]);
}

const deleteCommitmentRevocation = (connection, commitmentId) => {
    return connection.query('delete from CommitmentRevocation where commitmentId = ?', [commitmentId]);
}

const deleteTransactionKeys = (connection, address1, address2) => {
    return connection.query('delete from TransactionKey where ownerAddress in (?, ?)', [address1, address2]);
}

const getPublishedCommitments = (connection) => {
    return connection.query('select * from CommitmentTransaction where datePublished is not null');
}

module.exports = { getAccount, deletePeer, deleteTransactionKeys, getPublishedCommitments, deleteCommitmentRevocation, incrementAccountBalance, deleteCommitmentTransactions, getCommitmentRevocations, addCommitmentRevocation, getPeers, signCommitmentTransaction, getCommitments, getCommitmentTransaction, updateAccount, getTransactionKey, getLatestCommitmentTransaction, getFundingTransactions, deleteFundingTransaction, addTransactionToChain, addPeer, createAddressMapping, deleteAddressMapping, getOnlinePeers, getOnlineAccount, getFundingTransaction, addFundingTransaction, updateFundingTransaction, addTransactionKey, addCommitmentTransaction };