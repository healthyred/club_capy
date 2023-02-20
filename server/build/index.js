"use strict";
const rpcIdFindMatch = 'find_match_js';
let InitModule = function (ctx, logger, nk, initializer) {
    initializer.registerRpc(rpcIdFindMatch, rpcFindMatch);
    initializer.registerMatch(moduleName, {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal,
    });
    logger.info('JavaScript logic loaded.');
};
// The complete set of opcodes used for communication between clients and server.
var OpCode;
(function (OpCode) {
    // New game round starting.
    OpCode[OpCode["START"] = 1] = "START";
    // Update to the state of an ongoing round.
    OpCode[OpCode["UPDATE"] = 2] = "UPDATE";
    // Move was rejected.
    OpCode[OpCode["REJECTED"] = 4] = "REJECTED";
    // A move the player wishes to make and sends to the server.
    OpCode[OpCode["MOVE"] = 101] = "MOVE";
})(OpCode || (OpCode = {}));
const moduleName = "club_capy";
const tickRate = 5;
const maxEmptySec = 30;
// Copyright 2020 The Nakama Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
let rpcFindMatch = function (ctx, logger, nk, payload) {
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }
    if (!payload) {
        throw Error('Expects payload.');
    }
    let request = {};
    try {
        request = JSON.parse(payload);
    }
    catch (error) {
        logger.error('Error parsing json message: %q', error);
        throw error;
    }
    let matches;
    try {
        const query = `+label.open:1 +label.fast:${request.fast ? 1 : 0}`;
        matches = nk.matchList(10, true, null, null, 1, query);
    }
    catch (error) {
        logger.error('Error listing matches: %v', error);
        throw error;
    }
    let matchIds = [];
    if (matches.length > 0) {
        // There are one or more ongoing matches the user could join.
        matchIds = matches.map(m => m.matchId);
    }
    else {
        // No available matches found, create a new one.
        try {
            matchIds.push(nk.matchCreate(moduleName, { fast: request.fast }));
        }
        catch (error) {
            logger.error('Error creating match: %v', error);
            throw error;
        }
    }
    let res = { matchIds };
    return JSON.stringify(res);
};
// Copyright 2020 The Nakama Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
let matchInit = function (ctx, logger, nk, params) {
    const fast = !!params['fast'];
    var label = {
        open: 1,
        fast: 0,
    };
    if (fast) {
        label.fast = 1;
    }
    var state = {
        // label: label,
        playerPositions: { playerIds: [] },
        emptyTicks: 0,
        presences: {},
        joinsInProgress: 0,
    };
    return {
        state,
        tickRate,
        label: JSON.stringify(label),
    };
};
let matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    // Check if it's a user attempting to rejoin after a disconnect.
    if (presence.userId in state.presences) {
        if (state.presences[presence.userId] === null) {
            // User rejoining after a disconnect.
            state.joinsInProgress++;
            return {
                state: state,
                accept: false,
            };
        }
        else {
            // User attempting to join from 2 different devices at the same time.
            return {
                state: state,
                accept: false,
                rejectMessage: 'already joined',
            };
        }
    }
    // Check if match is full.
    if (connectedPlayers(state) + state.joinsInProgress >= 10) {
        return {
            state: state,
            accept: false,
            rejectMessage: 'match full',
        };
    }
    // New player attempting to connect.
    state.joinsInProgress++;
    return {
        state,
        accept: true,
    };
};
function randomIntFromInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
let matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    const t = msecToSec(Date.now());
    for (const presence of presences) {
        state.emptyTicks = 0;
        state.presences[presence.userId] = presence;
        state.joinsInProgress--;
        let new_position = [randomIntFromInterval(-100, 100), randomIntFromInterval(-100, 100)];
        state.playerPositions.playerIds.push({ playerId: presence.userId, position: new_position });
        let update = {
            playerPositions: state.playerPositions
        };
        dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(update));
    }
    return { state };
};
let matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (let presence of presences) {
        logger.info("Player: %s left match: %s.", presence.userId, ctx.matchId);
        state.presences[presence.userId] = null;
        // Remove positions from the game
        state.playerPositions.playerIds.filter((value) => {
            return value.playerId !== presence.userId;
        });
    }
    return { state };
};
let matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    logger.debug('Running match loop. Tick: %d', tick);
    if (connectedPlayers(state) + state.joinsInProgress === 0) {
        state.emptyTicks++;
        if (state.emptyTicks >= maxEmptySec * tickRate) {
            // Match has been empty for too long, close it.
            logger.info('closing idle match');
            return null;
        }
    }
    for (const message of messages) {
        switch (message.opCode) {
            case OpCode.MOVE:
                let sender = message.sender;
                logger.debug('Received move message from user: %v', sender);
                let msg = {};
                try {
                    msg = JSON.parse(nk.binaryToString(message.data));
                }
                catch (error) {
                    // Client sent bad data.
                    dispatcher.broadcastMessage(OpCode.REJECTED, null, [message.sender]);
                    logger.debug('Bad data received: %v', error);
                    continue;
                }
                // TODO: fix bounds later
                let indexToUpdate = state.playerPositions.playerIds.findIndex(playerPosition => playerPosition.playerId === sender.userId);
                state.playerPositions.playerIds[indexToUpdate] = { playerId: sender.userId, position: msg.position };
        }
    }
    let outgoingMsg = {
        playerPositions: state.playerPositions
    };
    dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(outgoingMsg));
    return { state };
};
function msecToSec(time) {
    return time * 1000;
}
let matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state };
};
let matchSignal = function (ctx, logger, nk, dispatcher, tick, state) {
    return { state };
};
function connectedPlayers(s) {
    let count = 0;
    for (const p of Object.keys(s.presences)) {
        if (p !== null) {
            count++;
        }
    }
    return count;
}
