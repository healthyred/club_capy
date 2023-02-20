extends Node

var client := Nakama.create_client("defaultkey", "127.0.0.1", 7350, "http")

onready var socket := Nakama.create_socket_from(client)

# Called when the node enters the scene tree for the first time.
func _ready():
	client.timeout = 10
	var session : NakamaSession = yield(client.authenticate_email_async("me@example.com", "eightchars", "me@example.com"), "completed")
	var connected : NakamaAsyncResult = yield(socket.connect_async(session), "completed")
	if connected.is_exception():
		print("An error occurred: %s" % connected)
		return
	print("Socket connected.")

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(_delta):
	pass
