extends Node2D

onready var server_connection := $ServerConnection

var _id;

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.

func initialize(id, x, y):
	self._id = id
	self.position.x = x
	self.position.y = y

func update_position(x, y):
	self.position.x = x
	self.position.y = y
