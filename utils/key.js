const crypto = require('crypto');
const choices = 'abcdefghijklmnopqrstuvwxyz0123456789';

const randomChoice = (sequence) => {
    let index = Math.round(Math.random() * (sequence.length - 1));
    return sequence[index];
}

const generateId = (length) => {
    let id = '';
    for (i = 0; i < length; i++) id += randomChoice(choices);
    return id;
}

const generateSecret = (length) => {
    let secret = '';
    for (i = 0; i < length; i++) secret += randomChoice(choices);
    return secret;
}

const hashSecret = (secret) => {
    const hash = crypto.createHash('sha256');
    hash.update(secret);
    return hash.digest('hex');
}

const verifySecret = (secret, hash) => {
    return hashSecret(secret) === hash;
}

module.exports = { randomChoice, generateSecret, hashSecret, verifySecret, generateId };