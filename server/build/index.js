"use strict";
function InitModule(ctx, logger, nk, initializer) {
    var rpcIdFindMatch = "find_match_js";
    initializer.registerRpc(rpcIdFindMatch, rpcFindMatch);
    initializer.registerMatch(moduleName, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal,
    });
    logger.info("JavaScript logic loaded.");
}
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
var moduleName = "club_capy";
var tickRate = 5;
var maxEmptySec = 30;
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
var rpcFindMatch = function (ctx, logger, nk, payload) {
    if (!ctx.userId) {
        throw Error('No user ID in context');
    }
    if (!payload) {
        throw Error('Expects payload.');
    }
    var request = {};
    try {
        request = JSON.parse(payload);
    }
    catch (error) {
        logger.error('Error parsing json message: %q', error);
        throw error;
    }
    var matches;
    try {
        var query = "+label.open:1 +label.fast:".concat(request.fast ? 1 : 0);
        matches = nk.matchList(10, true, null, null, 1, query);
    }
    catch (error) {
        logger.error('Error listing matches: %v', error);
        throw error;
    }
    var matchIds = [];
    if (matches.length > 0) {
        // There are one or more ongoing matches the user could join.
        matchIds = matches.map(function (m) { return m.matchId; });
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
    var res = { matchIds: matchIds };
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
var matchInit = function (ctx, logger, nk, params) {
    var fast = !!params["fast"];
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
        state: state,
        tickRate: tickRate,
        label: JSON.stringify(label),
    };
};
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
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
                rejectMessage: "already joined",
            };
        }
    }
    // Check if match is full.
    if (connectedPlayers(state) + state.joinsInProgress >= 10) {
        return {
            state: state,
            accept: false,
            rejectMessage: "match full",
        };
    }
    // New player attempting to connect.
    state.joinsInProgress++;
    return {
        state: state,
        accept: true,
    };
};
function randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    var t = msecToSec(Date.now());
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        state.emptyTicks = 0;
        state.presences[presence.userId] = presence;
        state.joinsInProgress--;
        var new_position = [
            randomIntFromInterval(-100, 100),
            randomIntFromInterval(-100, 100),
        ];
        state.playerPositions.playerIds.push({
            playerId: presence.userId,
            position: new_position,
        });
        var update = {
            playerPositions: state.playerPositions,
        };
        dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(update));
    }
    return { state: state };
};
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    var _loop_1 = function (presence) {
        logger.info("Player: %s left match: %s.", presence.userId, ctx.matchId);
        state.presences[presence.userId] = null;
        // Remove positions from the game
        state.playerPositions.playerIds.filter(function (value) {
            return value.playerId !== presence.userId;
        });
    };
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        _loop_1(presence);
    }
    return { state: state };
};
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    logger.debug("Running match loop. Tick: %d", tick);
    if (connectedPlayers(state) + state.joinsInProgress === 0) {
        state.emptyTicks++;
        if (state.emptyTicks >= maxEmptySec * tickRate) {
            // Match has been empty for too long, close it.
            logger.info("closing idle match");
            return null;
        }
    }
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        switch (message.opCode) {
            case OpCode.MOVE:
                var sender = message.sender;
                logger.debug("Received move message from user: %v", sender);
                var msg = {};
                try {
                    msg = JSON.parse(nk.binaryToString(message.data));
                }
                catch (error) {
                    // Client sent bad data.
                    dispatcher.broadcastMessage(OpCode.REJECTED, null, [message.sender]);
                    logger.debug("Bad data received: %v", error);
                    continue;
                }
                // TODO: fix bounds later
                var indexToUpdate = -1;
                for (var i = 0; i < state.playerPositions.playerIds.length; i++) {
                    if (state.playerPositions.playerIds[i].playerId === sender.userId) {
                        indexToUpdate = i;
                        break;
                    }
                }
                state.playerPositions.playerIds[indexToUpdate] = {
                    playerId: sender.userId,
                    position: msg.position,
                };
        }
    }
    var outgoingMsg = {
        playerPositions: state.playerPositions,
    };
    dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(outgoingMsg));
    return { state: state };
};
function msecToSec(time) {
    return time * 1000;
}
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
};
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state) {
    return { state: state };
};
function connectedPlayers(s) {
    var count = 0;
    for (var _i = 0, _a = Object.keys(s.presences); _i < _a.length; _i++) {
        var p = _a[_i];
        if (p !== null) {
            count++;
        }
    }
    return count;
}
