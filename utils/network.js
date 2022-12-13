const { getPeers, getLatestCommitmentTransaction } = require("../database");

const getNextExpirationDuration = (currentExpiration) => {
    const SECONDS = 1000;
    return (currentExpiration - 45) * SECONDS - Date.now();
}

const getInitialExpirationDuration = (hops) => {
    const SECONDS = 1000;
    return hops * 60 * SECONDS;
}

const getOptimalPeer = (connection, startAddress, endAddress, amount, depth) => {
    const graph = createGraph(connection, startAddress, endAddress, depth);
    if (graph === null) return undefined;
    var visited = new Map();
    visited.set(startAddress, 1e12);
    var queue = [];
    for (let edgeStr of graph.get(startAddress)) {
        let edge = edgeStr.split(' ');
        queue.push({firstNode: edge[0], currNode: edge[0], capacity: Number(edge[1])});
    }

    var optimalPeer = { address: '', capacity: 0 };
    while (queue.length > 0) {
        const obj = queue.shift();
        if (obj.currNode === endAddress) {
            if (optimalPeer.capacity < obj.capacity) optimalPeer = { address: obj.firstNode, capacity: obj.capacity };
            if (optimalPeer.capacity >= amount) break;
            else continue;
        }
        else if (visited.has(obj.currNode) && obj.capacity <= visited.get(obj.currNode)) continue;
        visited.set(obj.currNode, obj.capacity);
        for (let edgeStr of graph.get(obj.currNode)) {
            let edge = edgeStr.split(' ');
            queue.push({firstNode: obj.firstNode, currNode: edge[0], capacity: Math.min(obj.capacity, Number(edge[1]))});
        }
    }

    return optimalPeer;
}

const getPossibleNextHops = (connection, startAddress, endAddress, depth) => {
    const graph = createGraph(connection, startAddress, endAddress, depth);
    return graph === null ? new Set() : graph.get(startAddress);
}

const createGraph = (connection, startAddress, endAddress, depth, display = false) => {
    const fullGraph = buildGraph(connection, startAddress, endAddress, depth);
    if (!fullGraph.has(endAddress)) {
        if (display) console.log(`No route from ${startAddress} to ${endAddress} found!\n`);
        return null;
    }
    const condensedGraph = condenseGraph(connection, fullGraph, endAddress, startAddress, depth);
    if (display) displayGraph(condensedGraph, startAddress, endAddress, new Set());
    return condensedGraph;
}

const buildGraph = (connection, startAddress, endAddress, depth) => {
    var graph = new Map();
    var visitedAddresses = new Set();
    var peerCache = new Map();
    var queue = [{address: startAddress, depth: 0}];
    visitedAddresses.add(startAddress);

    while (queue.length > 0) {
        const node = queue.shift();
        if (!graph.has(node.address)) graph.set(node.address, new Set());
        if (node.address === endAddress || node.depth === depth) continue;
        if (!peerCache.has(node.address)) peerCache.set(node.address, getPeers(connection, node.address));
        for (let peer of peerCache.get(node.address)) {
            if (!graph.has(peer.address)) graph.set(peer.address, new Set());
            graph.get(node.address).add(peer.address);
            graph.get(peer.address).add(node.address);
            if (!visitedAddresses.has(peer.address)) {
                visitedAddresses.add(peer.address);
                queue.push({address: peer.address, depth: node.depth + 1});
            }
        }
    }

    return graph;
}

const condenseGraph = (connection, fullGraph, startAddress, endAddress, depth) => {
    var graph = new Map();
    var visitedAddresses = new Set();
    var commitmentCache = new Map();
    var queue = [{address: startAddress, depth: 0}];
    visitedAddresses.add(startAddress);

    while (queue.length > 0) {
        const node = queue.shift();
        if (!graph.has(node.address)) graph.set(node.address, new Set());
        if (node.address === endAddress || node.depth === depth) continue;
        for (let peerAddress of fullGraph.get(node.address)) {
            if (!graph.has(peerAddress)) graph.set(peerAddress, new Set());
            const cacheKey = node.address < peerAddress ? `${node.address} ${peerAddress}` : `${peerAddress} ${node.address}`;
            if (!commitmentCache.has(cacheKey)) commitmentCache.set(cacheKey, getLatestCommitmentTransaction(connection, node.address, peerAddress));
            const latestCommitment = commitmentCache.get(cacheKey);
            const edge1 = latestCommitment?.ownerAddress === node.address ? `${peerAddress} ${latestCommitment?.ownerAmount}` : `${peerAddress} ${latestCommitment?.counterpartyAmount}`;
            const edge2 = latestCommitment?.ownerAddress === peerAddress ? `${node.address} ${latestCommitment?.ownerAmount}` : `${node.address} ${latestCommitment?.counterpartyAmount}`;
            graph.get(node.address).add(edge1);
            graph.get(peerAddress).add(edge2);
            if (!visitedAddresses.has(peerAddress)) {
                visitedAddresses.add(peerAddress);
                queue.push({address: peerAddress, depth: node.depth + 1});
            }
        }
    }

    return graph;
}

const displayGraph = (graph, startAddress, endAddress) => {
    var edges = new Set();
    var visitedAddresses = new Set();
    var queue = [startAddress];
    visitedAddresses.add(startAddress);

    while (queue.length > 0) {
        const address = queue.shift();
        if (address === endAddress) continue;
        for (let peerEdge of graph.get(address)) {
            const peer = peerEdge.split(' ');
            edges.add(`${address} --${peer[1]}--> ${peer[0]}`);
            if (!visitedAddresses.has(peer[0])) {
                visitedAddresses.add(peer[0]);
                queue.push(peer[0]);
            }
        }
    }

    for (let edge of edges) console.log(edge);
    console.log();
}

module.exports = { getPossibleNextHops, getInitialExpirationDuration, getNextExpirationDuration, createGraph, buildGraph, condenseGraph, displayGraph, getOptimalPeer };