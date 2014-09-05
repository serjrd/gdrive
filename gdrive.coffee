#!/usr/bin/env coffee

fs = require 'fs'
path = require 'path'
google = require 'googleapis'
OAuth2 = google.auth.OAuth2
drive = google.drive('v2')

argv = require 'yargs'
		.alias {u: 'upload', f: 'folder', d: 'delete', l: 'list'}
		.describe 
			u: 'upload files'
			f: 'folder to upload files to'
			d: 'delete files matching a pattern (in any folder). Multiple -d arguments are allowed.'
			l: 'list files matching a pattern (in any folder). Multiple -l arguments are allowed.'
		.string ['l','d']
		.check (argv) ->
			# Check that we have the arguments we need
			if !((argv.u and argv.f) or argv.d or argv.l)
				return false
		.example "$0 -f backup -u file_1 another2 /path/other*.txt", "Upload all matching files to the 'backup' folder"
		.example "$0 -l 'file'", "List all files that have 'file' in their names"
		.example "$0 -d '_1' -d 'other'", "Delete files that have '_1' OR 'other' in their names"
		.example "$0 -d 'another*file'", "Delete files that have both 'another' AND 'file' in their names."
		.argv

# Filenames:
settings_file = "#{__dirname}/gdrive.settings"
auth_data = {}

# Google API params:
CLIENT_ID = '1094854616869-42qormvdak1b9m9becqhvgdmr0iml8f1.apps.googleusercontent.com'
CLIENT_SECRET = 'nRBXFUODEWXhijnt818eHAcj'
REDIRECT_URL = "urn:ietf:wg:oauth:2.0:oob"

oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)
google.options { auth: oauth2Client }

# This function updates the files that stores tokens (should probably be called every time before the script exits)
save_settings = () ->
	auth_data.tokens = oauth2Client.credentials
	fs.writeFileSync settings_file, JSON.stringify auth_data
	fs.chmod settings_file, '600'


gdrive = 
	getFolder: (folderName, callback) ->
		# Returns the ID of the first folder that matches the given name criteria
		drive.files.list
			q: "mimeType = 'application/vnd.google-apps.folder' and title = '#{folderName}'"
		, (err, response) ->
			if err
				console.log "#{err}"
			else
				if response['items']?[0]?['id']? 			# we found the folder
					callback response['items'][0]['id']
				else										# no such folder, so we will create it
					gdrive.createFolder folderName, (folderID) ->
						callback folderID

	createFolder: (name, callback) ->
		drive.files.insert
			resource:
				title: name
				mimeType: 'application/vnd.google-apps.folder'
		, (err, response) ->
			if err
				console.log "#{err}"
			else
				callback response.id

	deleteFiles: (pattern) ->
		gdrive.list pattern, (files) ->
			for file in files
				do (file) ->
					drive.files.delete
						fileId: file.id
					, (err, result) ->
						if err
							console.log "#{err}"
						else
							console.log "Deleted: #{file.title} [id: #{file.id}]"

	uploadFile: (fileName, folderName) ->
		# Get folder ID:
		gdrive.getFolder folderName, (folderId) ->
			drive.files.insert
				resource:
					title: path.basename fileName
					parents: [id: folderId]
					# mimeType: 'application/octet-stream'
				media:
					body: fs.createReadStream fileName
					# mimeType: 'application/octet-stream'
			, (err, response) ->
				if err
					console.log "#{err}"
				else
					console.log "Uploaded: #{response.title} [id: #{response.id}]"

	list: (pattern, callback) ->
		if Array.isArray pattern
			patternString = "title contains '#{pattern[0]}'"
			for condition in pattern[1..]
				patternString += " and title contains '#{condition}'"
		else
			patternString = "title contains '#{pattern}'"

		console.log "Listing: [#{patternString}]"
		drive.files.list
			q: patternString
		, (err, response) ->
			if err
				console.log "#{err}"
			else
				# console.log('list: ', response)
				callback response.items

	auth: (callback) ->
		# Handle the auth part:
		try
			# Let's try to read the settings from a file:
			auth_data = JSON.parse fs.readFileSync settings_file, {encoding: 'utf8'}
			oauth2Client.setCredentials auth_data.tokens
			save_settings()
			callback()
		catch e
			# No such file exists apparently. Request a new AUTH_CODE
			readline = require('readline')

			url = oauth2Client.generateAuthUrl
				response_type: 'code'
				scope: 'https://www.googleapis.com/auth/drive'

			console.log """
			
				Unable to read #{__dirname}/gdrive.settings
				Looks like you're running gdrive for the first time.
				We're gonna need some credentials to connect to your Google Drive.
				Please open the following URL in your browser:

				#{url}

				"""

			rl = readline.createInterface
				input: process.stdin
				output: process.stdout

			rl.question 'Enter the code here: ', (code) ->

				oauth2Client.getToken code, (err, tokens) ->
					if err
						console.log "ERR: #{err.stack}"
					else
						auth_data.code = code
						auth_data.tokens = tokens
						console.log "TOKENS: #{util.inspect tokens}"
				
						oauth2Client.setCredentials tokens
						save_settings()
						rl.close()

						callback()


# Authenticate and do what we are asked to:
gdrive.auth ->
	if argv.u
		args = argv._.concat [argv.u] 	# treat the rest of the arguments as filenames
		console.log "Uploading [#{args}]"
		for arg in args
			gdrive.uploadFile arg, argv.f
	else if argv.l
		args = if Array.isArray argv.l then argv.l else [argv.l]
		for arg in args
			pattern = arg.split '*'
			gdrive.list pattern, (files) ->
				console.log "Found: #{file.title} [id: #{file.id}]" for file in files
	else if argv.d
		args = if Array.isArray argv.d then argv.d else [argv.d]
		for arg in args
			pattern = arg.split '*'
			gdrive.deleteFiles pattern