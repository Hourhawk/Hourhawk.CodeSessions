var socket = io();
var uniqueIdentifier;
var loginIdentifier;
var userData;
var currSession;

// Functions //
function bodyHaze(obj1, obj2) {
	$('body').css('filter', 'blur(3px)');

	// Mass Reset //
	$('#landing').addClass('hide');
	$('#login').addClass('hide');
	$('#signup').addClass('hide');
	// Mass Reset //

	$(obj1).addClass('hide');
	$(obj2).removeClass('hide');
	setTimeout(function() {
		$('body').css('filter', '');
	}, 1000);
}
// Functions //

// Haze Links //
$('#landing-signup').click(function() {
	bodyHaze('#landing', '#signup');
});
$('#account-signup').click(function() {
	bodyHaze('#landing', '#signup');
});
$('#account-login').click(function() {
	bodyHaze('#landing', '#login');
});
$('#signup-back').click(function() {
	bodyHaze('#signup', '#landing');
});
$('#login-back').click(function() {
	bodyHaze('#login', '#landing');
});
// Haze Links //

// Forms to Server //
$('#form-signup').click(function() {
	var signupemail = $('#signup-email').val();
	var signuppassword = $('#signup-password').val();
	var signupconpassword = $('#signup-conpassword').val();
	socket.emit('signup', uniqueIdentifier, [signupemail, signuppassword, signupconpassword]);
});
$('#form-login').click(function() {
	var loginemail = $('#login-email').val();
	var loginpassword = $('#login-password').val();
	var loginconpassword = $('#login-conpassword').val();
	socket.emit('login', uniqueIdentifier, [loginemail, loginpassword, loginconpassword]);
});
$('#account-logout').click(function() {
	socket.emit('logout', uniqueIdentifier, loginIdentifier);
});
// Forms to Server //

// Server //
socket.on('assignidentifier', function(serverIdentifier) {
	uniqueIdentifier = serverIdentifier;
});
socket.on('login', function(serverLIdentifier, data) {
	setTimeout(function() {
		userData = data;
		loginIdentifier = serverLIdentifier;
		$('#logged-userinfo').html('You\'re currently logged in as: ' + userData['email'] + '.');
		$('#notlogged').addClass('hide');
		$('#loggedin').removeClass('hide');
		$('#account-login').addClass('hide');
		$('#account-signup').addClass('hide');
		$('#account-logout').removeClass('hide');
		bodyHaze('#notlogged', '#loggedin');
	}, 1000);
});
socket.on('logout', function() {
		loginIdentifier = null;
		userData = null;
		$('#notlogged').removeClass('hide');
		$('#loggedin').addClass('hide');
		$('#account-login').removeClass('hide');
		$('#account-signup').removeClass('hide');
		$('#account-logout').addClass('hide');
		bodyHaze('#loggedin', '#notlogged');
		$('#landing').removeClass('hide');
});
socket.on('formresponse', function(data) {
	var form = data[0];
	var type = data[1];
	var message = data[2];
	var currentVal = $('#' + form).text();
	$('#' + form).removeClass('btn-cs').addClass('btn-cs-res');
	if(type == 'error') {
		$('#' + form).css('background-color', '#cc4e4e');
	} else if(type == 'dev') {
		$('#' + form).css('background-color', '#ccc34e');
	} else if(type == 'success') {
		$('#' + form).css('background-color', '#4ECCA3');
	}
	$('#' + form).html(message);
	setTimeout(function() {
		$('#' + form).css('background-color', '');
		$('#' + form).css('color', '');
		$('#' + form).html(currentVal);
		$('#' + form).addClass('btn-cs').removeClass('btn-cs-res');
	}, 1500);
});
// Server //
// Sessions //
$('#session-new').click(function() {
	socket.emit('session-new', uniqueIdentifier, loginIdentifier);
});
socket.on('session-new', function(newSessionId, language, sessionUsers) {
	editor.setValue('');
	currSession = newSessionId;
	editor.session.setMode("ace/mode/" + language);
	$('#loggedin-session-id').html('Session Code: ' + newSessionId);
	var usersString;
	for(var i = 0; i < sessionUsers.length; i++) {
		if(usersString == null) {
			usersString = sessionUsers[i];
		} else {
			usersString = usersString + ", " + sessionUsers[i];
		}
	}
	$('#loggedin-session-list').html('<strong>Connected Users: </strong>' + usersString);
	bodyHaze('#loggedin-landing', '#loggedin-session');
});
$('#loggedin-session-exit').click(function() {
	socket.emit('session-exit', uniqueIdentifier, loginIdentifier);
});
socket.on('session-exit', function() {
	currSession = null;
	bodyHaze('#loggedin-session', '#loggedin-landing');
});
$('#session-join').click(function() {
	bodyHaze('#loggedin-landing', '#loggedin-session-join');
});
$('#join-session-back').click(function() {
	bodyHaze('#loggedin-session-join', '#loggedin-landing');
});
$('#session-join-code').click(function() {
	var code = $('#session-code').val();
	socket.emit('session-join', uniqueIdentifier, loginIdentifier, code);
});
socket.on('session-join', function(joinSessionId, language, editorValue, sessionUsers) {
	editor.setValue('');
	currSession = joinSessionId;
	editor.session.setMode("ace/mode/" + language);
	editor.session.setValue(editorValue);
	$('#loggedin-session-id').html('Session Code: ' + joinSessionId);
	if(language != null) {
		$('#loggedin-session-dropdown-language').html($('#language-' + language).html());
	}
	var usersString;
	for(var i = 0; i < sessionUsers.length; i++) {
		if(usersString == null) {
			usersString = sessionUsers[i];
		} else {
			usersString = usersString + ", " + sessionUsers[i];
		}
	}
	$('#loggedin-session-list').html('<strong>Connected Users: </strong>' + usersString);
	bodyHaze('#loggedin-session-join', '#loggedin-session');
});
socket.on('session-list-update', function(sessionUsers) {
	var usersString;
	for(var i = 0; i < sessionUsers.length; i++) {
		if(usersString == null) {
			usersString = sessionUsers[i];
		} else {
			usersString = usersString + ", " + sessionUsers[i];
		}
	}
	$('#loggedin-session-list').html('<strong>Connected Users: </strong>' + usersString);
});
// Sessions //
// Ace //
var editor = ace.edit("editor");
editor.setTheme("ace/theme/dracula");
editor.setOptions({fontSize: "11pt"});

var themes = ['dracula', 'github'];
themes.forEach(function(theme) {
	$('#theme-' + theme).click(function() {
		editor.setTheme("ace/theme/" + theme);
	});
});
var languages = ['html', 'javascript', 'css', 'php', 'xml', 'json', 'mysql', 'java', 'c_cpp', 'csharp', 'rust', 'ruby', 'lua', 'coffee'];
languages.forEach(function(language) {
	$('#language-' + language).click(function() {
		editor.session.setMode("ace/mode/" + language);
		socket.emit('session-language-change', uniqueIdentifier, loginIdentifier, currSession, language);
	});
});
socket.on('session-language-change', function(language) {
	editor.session.setMode("ace/mode/" + language);
	$('#loggedin-session-dropdown-language').html($('#language-' + language).html());
});
var canFireChange = true;
editor.getSession().on('change', function() {
	if(canFireChange) {
		socket.emit('session-editor-update', uniqueIdentifier, loginIdentifier, currSession, editor.getValue());
	}
});
socket.on('session-editor-update', function(editorValue) {
	canFireChange = false;
	if(editorValue != editor.getValue()) {
		var currentPosition = editor.selection.getCursor();
		var prevLength = editor.session.doc.getAllLines().length;
		editor.setValue(editorValue);
		editor.clearSelection();
		editor.gotoLine(currentPosition.row+1, currentPosition.column);
	}
	canFireChange = true;
});
$('#loggedin-session-download').click(function() {
	socket.emit('loggedin-session-download', uniqueIdentifier, loginIdentifier, currSession, editor.getValue());
});
socket.on('loggedin-session-download', function(downloadPath, fileName) {
	var anchor = document.createElement('a');
	anchor.href = downloadPath;
	anchor.target = '_blank';
	anchor.download = fileName;
	anchor.click();
});
// Ace //