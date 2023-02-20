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

const moduleName = "club_capy";
const tickRate = 5;
const maxEmptySec = 30;

interface State {
    // Current state of the board.
    playerPositions: PlayerPositionList
    // Ticks where no actions have occurred.
    emptyTicks: number
    // Currently connected users, or reserved spaces.
    presences: {[userId: string]: nkruntime.Presence | null}
    // Number of users currently in the process of connecting to the match.
    joinsInProgress: number
    // To determine
    // label: string
}

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