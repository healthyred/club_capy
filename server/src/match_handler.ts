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

let matchInit: nkruntime.MatchInitFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
) {
  logger.debug("Initializing match");
  const fast = !!params["fast"];

  var label: MatchLabel = {
    open: 1,
    fast: 0,
  };
  if (fast) {
    label.fast = 1;
  }

  var state: State = {
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

let matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
) {
  // Check if it's a user attempting to rejoin after a disconnect.
  if (presence.userId in state.presences) {
    if (state.presences[presence.userId] === null) {
      // User rejoining after a disconnect.
      state.joinsInProgress++;
      return {
        state: state,
        accept: false,
      };
    } else {
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
    state,
    accept: true,
  };
};

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

let matchJoin: nkruntime.MatchJoinFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  presences: nkruntime.Presence[]
) {
  logger.debug("Player joining match: " + ctx.userId);
  const t = msecToSec(Date.now());
  for (const presence of presences) {
    state.emptyTicks = 0;
    state.presences[presence.userId] = presence;
    state.joinsInProgress--;
    let new_position: [number, number] = [
      randomIntFromInterval(-100, 100),
      randomIntFromInterval(-100, 100),
    ];
    state.playerPositions.playerIds.push({
      playerId: presence.userId,
      position: new_position,
    });

    let update: UpdateMessage = {
      playerPositions: state.playerPositions,
    };
    dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(update));
  }
  return { state };
};

let matchLeave: nkruntime.MatchLeaveFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  presences: nkruntime.Presence[]
) {
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

let matchLoop: nkruntime.MatchLoopFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  messages: nkruntime.MatchMessage[]
) {
  //   logger.debug("Running match loop. Tick: %d", tick);

  if (connectedPlayers(state) + state.joinsInProgress === 0) {
    state.emptyTicks++;
    if (state.emptyTicks >= maxEmptySec * tickRate) {
      // Match has been empty for too long, close it.
      logger.info("closing idle match");
      return null;
    }
  }

  for (const message of messages) {
    switch (message.opCode) {
      case OpCode.MOVE:
        let sender = message.sender;
        logger.debug("Received move message from user: %v", sender);
        let msg = {} as MoveMessage;
        try {
          msg = JSON.parse(nk.binaryToString(message.data));
        } catch (error) {
          // Client sent bad data.
          dispatcher.broadcastMessage(OpCode.REJECTED, null, [message.sender]);
          logger.debug("Bad data received: %v", error);
          continue;
        }

        // TODO: fix bounds later
        let indexToUpdate = -1;
        for (let i = 0; i < state.playerPositions.playerIds.length; i++) {
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
  let outgoingMsg: UpdateMessage = {
    playerPositions: state.playerPositions,
  };
  //   logger.debug("Sending outgoing message %v", outgoingMsg);
  dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(outgoingMsg));

  return { state };
};

function msecToSec(time: number) {
  return time * 1000;
}

let matchTerminate: nkruntime.MatchTerminateFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  graceSeconds: number
) {
  return { state };
};

let matchSignal: nkruntime.MatchSignalFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State
) {
  return { state };
};

function connectedPlayers(s: State): number {
  let count = 0;
  for (const p of Object.keys(s.presences)) {
    if (p !== null) {
      count++;
    }
  }
  return count;
}
