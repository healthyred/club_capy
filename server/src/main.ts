let InitModule: nkruntime.InitModule =
        function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("Hello World!");
}

// The complete set of opcodes used for communication between clients and server.
enum OpCode {
	// New game round starting.
	START = 1,
	// Update to the state of an ongoing round.
	UPDATE = 2,
	// Move was rejected.
	REJECTED = 4,
    // A move the player wishes to make and sends to the server.
	MOVE = 101
}

type PlayerPosition = {
    // Player IDs
    playerId: String
    // Position from a range of -100,100 for x, y  game map coordinates
    position: [number, number]
}
type PlayerPositionList = { 
    // Player Id list
    playerIds: PlayerPosition[]
}
type Message = StartMessage|UpdateMessage|MoveMessage|RpcFindMatchRequest|RpcFindMatchResponse

// Message data sent by server to clients representing a new game round starting.
interface StartMessage {
    // The current state of the board.
    playerPositions: PlayerPositionList
}

// A game state update sent by the server to clients.
interface UpdateMessage {
    // The current state of the board.
    playerPositions: PlayerPositionList
}

// A player intends to make a move.
interface MoveMessage {
    // Position from a range of -100,100 for x, y  game map coordinates
    position: [number, number]
}

// Payload for an RPC request to find a match.
interface RpcFindMatchRequest {
    // User can choose a fast or normal speed match.
    fast: boolean
}

// Payload for an RPC response containing match IDs the user can join.
interface RpcFindMatchResponse {
    // One or more matches that fit the user's request.
    matchIds: string[]
}

interface MatchLabel {
    open: number
    fast: number
}

let matchInit: nkruntime.MatchInitFunction<State> = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}) {
    const fast = !!params['fast'];

    var label: MatchLabel = {
        open: 1,
        fast: 0,
    }
    if (fast) {
        label.fast = 1;
    }
    
    var state: State = {
        // label: label,
        playerPositions: PlayerPosition[] = [],
        emptyTicks: 0,
        presences: {},
        joinsInProgress: 0,
    }

    return {
        state,
        tickRate,
        label: JSON.stringify(label),
    }
}

let matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<State> = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: State, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    // Check if it's a user attempting to rejoin after a disconnect.
    if (presence.userId in state.presences) {
        if (state.presences[presence.userId] === null) {
            // User rejoining after a disconnect.
            state.joinsInProgress++;
            return {
                state: state,
                accept: false,
            }
        } else {
            // User attempting to join from 2 different devices at the same time.
            return {
                state: state,
                accept: false,
                rejectMessage: 'already joined',
            }
        }
    }

    // Check if match is full.
    if (connectedPlayers(state) + state.joinsInProgress >= 2) {
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
    }
}