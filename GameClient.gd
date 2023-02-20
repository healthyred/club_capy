extends Node

const START = 1
const UPDATE = 2
const REJECTED = 3
const MOVE = 101

const PLAYER_GROUP = "Player"

export (PackedScene) var player_scene
onready var server_connection := $ServerConnection

func _ready():
	var socket : NakamaSocket = server_connection.socket
	var _ignore = socket.connect("received_match_state", self, "_on_match_state")

func get_user_id():
	var current_match : NakamaRTAPI.Match = server_connection.current_match
	return current_match.self_user.user_id

func spawn_player(id, x, y):
	var player = player_scene.instance()
	player.initialize(id, x, y)
	player.add_to_group(PLAYER_GROUP)
	add_child(player)

func handle_update(match_data):
	var start_message = JSON.parse(match_data)
	var dict = {}
	for player in get_tree().get_nodes_in_group(PLAYER_GROUP):
		dict[player.id] = player
	for player_info in start_message.playerPositions.playerIDs:
		var player_id = player_info.playerId
		var position = player_info.position
		var x = position[0]
		var y = position[1]
		if dict.has(player_id):
			print("Updating player %s to position (%s, %s)", player_id, x, y)
			var player = dict[player_id]
			player.update(x, y)
		else:
			print("Spawning player %s at position (%s, %s)", player_id, x, y)
			spawn_player(player_id, x, y)
		

func _on_match_state(match_state : NakamaRTAPI.MatchData):
	match match_state.op_code:
		START:
			print("Match state: Start")
			handle_update(match_state.data)
		UPDATE:
			print("Match state: Update")
			handle_update(match_state.data)
		REJECTED:
			print("Match state: Rejected")
		_:
			print("Match staet: Unsupported op code: %s", match_state.op_code)

func send_move_request(position):
	var current_match : NakamaRTAPI.Match = server_connection.current_match
	var socket : NakamaSocket = server_connection.socket
	var move_request = {
		position = [position.x, position.y]
	}
	yield(socket.send_match_state_async(current_match.id, MOVE, JSON.print(move_request)), "completed")

func _input(event):
	if event is InputEventMouseButton:
		if event.pressed:
			print("Mouse Click at %s", event.position)
			send_move_request(event.position)
	