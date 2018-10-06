var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var shortid = require('shortid');
var mysql = require('mysql');
var validator = require("email-validator");
var bcrypt = require("bcrypt");
var rn = require('random-number');
var fs = require('fs');

var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'codesessions'
});

app.use(express.static('public'));
app.get('/', function(req, res) {
  res.send(__dirname + '/index.html');
});

http.listen(80, function(){
  console.log('listening on *:80');
});

const saltOptions = {
  min:  6,
  max:  15,
  integer: true
}

function mysql_escape (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char;
        }
    });
}

var currentSessions = {

}

io.on('connection', function(socket) {
	var sockets = {
		uniqueIdentifier: shortid.generate(),
		loginIdentifier: Math.random(),
		userId: null,
		permissionLevel: null,
		canCreateAcc: false,
		inSession: false,
		email: null
	}
	console.log('[Server]: Connection received from ' + sockets['uniqueIdentifier']);
	socket.emit('assignidentifier', sockets['uniqueIdentifier']);
	socket.uniqueIdentifier = sockets['uniqueIdentifier'];

	socket.on('signup', function(clientIdentifier, data) {
		console.log('[Server]: Signup received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier']) {
			if(sockets['canCreateAcc']) {
				socket.emit('formresponse', ['form-signup', 'error', 'Your account was already created.']);
				return;
			}
			var email = data[0];
			var password = data[1];
			var conpassword = data[2];
			if(validator.validate(email)) {
				if(password.length > 6) {
					if(password == conpassword) {
						connection.query("SELECT id FROM users WHERE email='" + mysql_escape(email) + "'", function(error, results, fields) {
							if(results[0] == null) {
								var salt = rn(saltOptions);
								//var salt = 10;
								bcrypt.hash(password, salt, function(herr, hash) {
									if(herr) {
										throw herr;
										socket.emit('formresponse', ['form-signup', 'dev', 'There was an error hashing your password.']);
									} else {
										connection.query("INSERT INTO users(email, password, salt) VALUES('" + mysql_escape(email) + "','" + hash + "','" + salt + "')", function(ierr) {
											if(ierr) {
												throw ierr;
												socket.emit('formresponse', ['form-signup', 'dev', 'A database error occurred.']);
											} else {
												sockets['canCreateAcc'] = true;
												socket.emit('formresponse', ['form-signup', 'success', 'Your account was succesfully created. You may now login.']);
											}
										});
									}
								});
							} else {
								socket.emit('formresponse', ['form-signup', 'error', 'The email entered is already in use.']);
							}
						});
					} else {
						socket.emit('formresponse', ['form-signup', 'error', 'Your passwords don\'t match!']);
					}
				} else {
					socket.emit('formresponse', ['form-signup', 'error', 'Your password must be at least 7 characters long.']);
				}
			} else {
				socket.emit('formresponse', ['form-signup', 'error', 'Your email isn\'t valid.']);
			}
		} else {
			socket.emit('formresponse', ['form-signup', 'dev', 'Your session isn\'t valid.']);
		}
	});
	socket.on('login', function(clientIdentifier, data) {
		console.log('[Server]: Login received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier']) {
			var email = data[0];
			var password = data[1];
			connection.query("SELECT * FROM users WHERE email='" + mysql_escape(email) + "'", function(error, results, fields) {
				if(results[0] != null) {
					bcrypt.compare(password, results[0]['password'], function(err, res) {
						if(err) {
							throw err;
							socket.emit('formresponse', ['form-login', 'dev', 'There was an issue comparing your password.']);
						} else {
							if(res) {
								socket.emit('formresponse', ['form-login', 'success', 'Logging in...']);
								sockets['loginIdentifier'] = shortid.generate();
								var data = {
									email: results[0]['email']
								}
								sockets['email'] = results[0]['email'];
								socket.emit('login', sockets['loginIdentifier'], data);
							} else {
								socket.emit('formresponse', ['form-login', 'error', 'The password you entered was incorrect.']);
							}
						}
					});
				} else {
					socket.emit('formresponse', ['form-login', 'error', 'That email doesn\'t exist.']);
				}
			});
		} else {
			socket.emit('formresponse', ['login-signup', 'dev', 'Your session isn\'t valid.']);
		}
	});
	socket.on('logout', function(clientIdentifier, loginIdentifier) {
		console.log('[Server]: Logout received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			sockets['loginIdentifier'] = Math.random();
			socket.emit('logout');
		}
	});
	socket.on('session-new', function(clientIdentifier, loginIdentifier) {
		console.log('[Server]: New Session received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			if(sockets['inSession'] == false) {
				var newSessionId = shortid.generate();
				currentSessions[newSessionId] = {};
				currentSessions[newSessionId]['language'] = '';
				currentSessions[newSessionId]['text'] = '';
				currentSessions[newSessionId][sockets['email']] = sockets['uniqueIdentifier'];
				sockets['inSession'] = newSessionId;
				var sessionUsers = [];
				sessionUsers.push(sockets['email']);
				socket.emit('session-new', newSessionId, currentSessions[newSessionId]['language'], sessionUsers);
			} else {
				socket.emit('formresponse', ['session-new', 'error', 'You\'re currently in a session. Try relogging.']);
			}
		} else {
			socket.emit('formresponse', ['session-new', 'dev', 'Your session isn\'t valid.']);
		}
	});
	socket.on('session-exit', function(clientIdentifier, loginIdentifier) {
		console.log('[Server]: Exit Session received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			if(sockets['inSession'] != false) {
				currentSessions[sockets['inSession']][sockets['email']] = null;
				if(currentSessions[sockets['inSession']].length <= 0) {
					currentSessions[sockets['inSession']] = null;
				}
				var sessionCode = sockets['inSession'];
				sockets['inSession'] = false;
				var sessionUsers = [];
				Object.keys(currentSessions[sessionCode]).forEach(function(email) {
					if(email.includes("@") && currentSessions[sessionCode][email] != null) {
						sessionUsers.push(email);
					}
				});
				Object.keys(io.sockets.sockets).forEach(function(socketId) {
					Object.keys(currentSessions[sessionCode]).forEach(function(key) {
						if(currentSessions[sessionCode][key] == io.sockets.sockets[socketId].uniqueIdentifier) {
							io.sockets.sockets[socketId].emit('session-list-update', sessionUsers);
						}
					});
				});
				socket.emit('session-exit');
			}
		}
	});
	socket.on('session-join', function(clientIdentifier, loginIdentifier, sessionCode) {
		console.log('[Server]: Join Session received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			if(sockets['inSession'] == false) {
				if(currentSessions[sessionCode] != null) {
					currentSessions[sessionCode][sockets['email']] = sockets['uniqueIdentifier'];
					sockets['inSession'] = sessionCode;
					var sessionUsers = [];
					Object.keys(currentSessions[sessionCode]).forEach(function(email) {
						if(email.includes("@")) {
							sessionUsers.push(email);
						}
					});
					Object.keys(io.sockets.sockets).forEach(function(socketId) {
						Object.keys(currentSessions[sessionCode]).forEach(function(key) {
							if(currentSessions[sessionCode][key] == io.sockets.sockets[socketId].uniqueIdentifier) {
								io.sockets.sockets[socketId].emit('session-list-update', sessionUsers);
							}
						});
					});
					socket.emit('session-join', sessionCode, currentSessions[sessionCode]['language'], currentSessions[sessionCode]['text'], sessionUsers);
				} else {
					socket.emit('formresponse', ['session-join-code', 'error', 'That session doesn\'t exist.']);
				}
			} else {
				socket.emit('formresponse', ['session-join-code', 'error', 'You\'re already in a session. Try relogging.']);
			}
		} else {
			socket.emit('formresponse', ['session-join-code', 'dev', 'Your session isn\'t valid.']);
		}
	});
	socket.on('session-language-change', function(clientIdentifier, loginIdentifier, sessionCode, language) {
		console.log('[Server]: Language Change received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			if(sockets['inSession'] == sessionCode) {
				currentSessions[sessionCode]['language'] = language;
				Object.keys(io.sockets.sockets).forEach(function(socketId) {
					Object.keys(currentSessions[sessionCode]).forEach(function(key) {
						if(currentSessions[sessionCode][key] == io.sockets.sockets[socketId].uniqueIdentifier) {
							io.sockets.sockets[socketId].emit('session-language-change', language);
						}
					});
				});
			}
		}
	});
	socket.on('session-editor-update', function(clientIdentifier, loginIdentifier, sessionCode, editorValue) {
		console.log('[Server]: Editor Value Update received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			if(sockets['inSession'] == sessionCode) {
				currentSessions[sessionCode]['text'] = editorValue;
				Object.keys(io.sockets.sockets).forEach(function(socketId) {
					Object.keys(currentSessions[sessionCode]).forEach(function(key) {
						if(currentSessions[sessionCode][key] == io.sockets.sockets[socketId].uniqueIdentifier && io.sockets.sockets[socketId].uniqueIdentifier != sockets['uniqueIdentifier']) {
							io.sockets.sockets[socketId].emit('session-editor-update', editorValue);
						}
					});
				});
			}
		}
	});
	socket.on('loggedin-session-download', function(clientIdentifier, loginIdentifier, sessionCode, editorValue) {
		console.log('[Server]: Download Request received from ' + clientIdentifier);
		if(clientIdentifier == sockets['uniqueIdentifier'] && loginIdentifier == sockets['loginIdentifier']) {
			if(sockets['inSession'] == sessionCode) {
				var extension = currentSessions[sessionCode]['language'];
				if(extension == '' || extension == null) {
					extension = 'txt';
				}
				var extensionArray = {'c_cpp':'cpp','ruby':'rb','csharp':'cs','javascript':'js','rust':'rs','typescript':'ts'};
				if(extensionArray[extension] != null) {
					extension = extensionArray[extension];
				}
				fs.writeFile('./public/downloads/' + sessionCode + '.' + extension, editorValue, 'utf8', function(err) {
					if (err) {
						throw err;
						return;
					}
					socket.emit('loggedin-session-download', './downloads/' + sessionCode + '.' + extension, sessionCode + '.' + extension);
				});
			}
		}
	});
});