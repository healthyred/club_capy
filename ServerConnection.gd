extends Node

var client := Nakama.create_client("defaultkey", "127.0.0.1", 7350, "http")

var socket : NakamaSocket
var session : NakamaSession
var current_match : NakamaRTAPI.Match

var game_client 

func _join_match():
	var result : NakamaAPI.ApiMatchList = yield(client.list_matches_async(session, 0, 1024, 1, true, "", ""), "completed")
	var selected_match = null
	for m in result.matches:
		print("%s: %s players", m.match_id, m.size)
		if selected_match == null:
			selected_match = m
	if selected_match != null:
		print("Joining existing match", selected_match.match_id)
		current_match = yield(socket.join_match_async(selected_match.match_id), "completed")
	else:
		print("No matches found, creating a new one")
		current_match = yield(socket.create_match_async(), "completed")
	game_client = get_node("GameClient")
	game_client.initialize(current_match, socket)

func _ready():
	client.timeout = 10
	socket = Nakama.create_socket_from(client)
	print("Socket created.")
	session = yield(client.authenticate_email_async("me@example.com", "eightchars", "me@example.com"), "completed")
	print("Authenticated.")
	var connected : NakamaAsyncResult = yield(socket.connect_async(session), "completed")
	print("Session connected.")
	if connected.is_exception():
		print("An error occurred: %s" % connected)
		return
	print("Socket connected.")
	_join_match()

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(_delta):
	pass
