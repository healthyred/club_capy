extends Node

const START = 1
const UPDATE = 2
const REJECTED = 3
const MOVE = 101

const PLAYER_GROUP = "Player"

export (PackedScene) var player_scene

var current_match : NakamaRTAPI.Match
var socket : NakamaSocket 

func initialize(p_match, p_socket):
	current_match = p_match
	socket = p_socket
	var _ignore = socket.connect("received_match_state", self, "_on_match_state")

func get_user_id():
	return current_match.self_user.user_id

func spawn_player(id, x, y):
	var player = player_scene.instance()
	player.initialize(id, x, y)
	player.add_to_group(PLAYER_GROUP)
	add_child(player)


func handle_update(match_data):
	var start_message = JSON.parse(match_data).result
	var dict = {}
	for player in get_tree().get_nodes_in_group(PLAYER_GROUP):
		dict[player._id] = player
	for player_info in start_message.playerPositions.playerIds:
		var player_id = player_info.playerId
		var position = player_info.position
		var x = position[0]
		var y = position[1]
		if dict.has(player_id):
			print("Updating player %s to position (%s, %s)" % [player_id, x, y])
			var player = dict[player_id]
			player.update_position(x, y)
		else:
			print("Spawning player %s at position (%s, %s)" % [player_id, x, y])
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
			print("Match state: Unsupported op code: %s" % match_state.op_code)

func send_move_request(position):
	var move_request = {
		position = [position.x, position.y]
	}
	var move_request_json = JSON.print(move_request)
	print("Sending move request: %s" % move_request_json)
	yield(socket.send_match_state_async(current_match.match_id, MOVE, move_request_json), "completed")

func _input(event):
	if event is InputEventMouseButton:
		if event.pressed:
			print("Mouse Click at %s" % event.position)
			send_move_request(event.position)
	
