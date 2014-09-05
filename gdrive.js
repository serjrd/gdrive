#!/usr/bin/env node

// Generated by CoffeeScript 1.8.0
var CLIENT_ID, CLIENT_SECRET, OAuth2, REDIRECT_URL, argv, auth_data, drive, fs, gdrive, google, oauth2Client, path, save_settings, settings_file;

fs = require('fs');

path = require('path');

google = require('googleapis');

OAuth2 = google.auth.OAuth2;

drive = google.drive('v2');

argv = require('yargs').alias({
  u: 'upload',
  f: 'folder',
  d: 'delete',
  l: 'list'
}).describe({
  u: 'upload files',
  f: 'folder to upload files to',
  d: 'delete files matching a pattern (in any folder). Multiple -d arguments are allowed.',
  l: 'list files matching a pattern (in any folder). Multiple -l arguments are allowed.'
}).string(['l', 'd']).check(function(argv) {
  if (!((argv.u && argv.f) || argv.d || argv.l)) {
    return false;
  }
}).example("$0 -f backup -u file_1 another2 /path/other*.txt", "Upload all matching files to the 'backup' folder").example("$0 -l 'file'", "List all files that have 'file' in their names").example("$0 -d '_1' -d 'other'", "Delete files that have '_1' OR 'other' in their names").example("$0 -d 'another*file'", "Delete files that have both 'another' AND 'file' in their names.").argv;

settings_file = "" + __dirname + "/gdrive.settings";

auth_data = {};

CLIENT_ID = '1094854616869-42qormvdak1b9m9becqhvgdmr0iml8f1.apps.googleusercontent.com';

CLIENT_SECRET = 'nRBXFUODEWXhijnt818eHAcj';

REDIRECT_URL = "urn:ietf:wg:oauth:2.0:oob";

oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

google.options({
  auth: oauth2Client
});

save_settings = function() {
  auth_data.tokens = oauth2Client.credentials;
  fs.writeFileSync(settings_file, JSON.stringify(auth_data));
  return fs.chmod(settings_file, '600');
};

gdrive = {
  getFolder: function(folderName, callback) {
    return drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and title = '" + folderName + "'"
    }, function(err, response) {
      var _ref, _ref1;
      if (err) {
        return console.log("" + err);
      } else {
        if (((_ref = response['items']) != null ? (_ref1 = _ref[0]) != null ? _ref1['id'] : void 0 : void 0) != null) {
          return callback(response['items'][0]['id']);
        } else {
          return gdrive.createFolder(folderName, function(folderID) {
            return callback(folderID);
          });
        }
      }
    });
  },
  createFolder: function(name, callback) {
    return drive.files.insert({
      resource: {
        title: name,
        mimeType: 'application/vnd.google-apps.folder'
      }
    }, function(err, response) {
      if (err) {
        return console.log("" + err);
      } else {
        return callback(response.id);
      }
    });
  },
  deleteFiles: function(pattern) {
    return gdrive.list(pattern, function(files) {
      var file, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        _results.push((function(file) {
          return drive.files["delete"]({
            fileId: file.id
          }, function(err, result) {
            if (err) {
              return console.log("" + err);
            } else {
              return console.log("Deleted: " + file.title + " [id: " + file.id + "]");
            }
          });
        })(file));
      }
      return _results;
    });
  },
  uploadFile: function(fileName, folderName) {
    return gdrive.getFolder(folderName, function(folderId) {
      return drive.files.insert({
        resource: {
          title: path.basename(fileName),
          parents: [
            {
              id: folderId
            }
          ]
        },
        media: {
          body: fs.createReadStream(fileName)
        }
      }, function(err, response) {
        if (err) {
          return console.log("" + err);
        } else {
          return console.log("Uploaded: " + response.title + " [id: " + response.id + "]");
        }
      });
    });
  },
  list: function(pattern, callback) {
    var condition, patternString, _i, _len, _ref;
    if (Array.isArray(pattern)) {
      patternString = "title contains '" + pattern[0] + "'";
      _ref = pattern.slice(1);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        condition = _ref[_i];
        patternString += " and title contains '" + condition + "'";
      }
    } else {
      patternString = "title contains '" + pattern + "'";
    }
    console.log("Listing: [" + patternString + "]");
    return drive.files.list({
      q: patternString
    }, function(err, response) {
      if (err) {
        return console.log("" + err);
      } else {
        return callback(response.items);
      }
    });
  },
  auth: function(callback) {
    var e, readline, rl, url;
    try {
      auth_data = JSON.parse(fs.readFileSync(settings_file, {
        encoding: 'utf8'
      }));
      oauth2Client.setCredentials(auth_data.tokens);
      save_settings();
      return callback();
    } catch (_error) {
      e = _error;
      readline = require('readline');
      url = oauth2Client.generateAuthUrl({
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive'
      });
      console.log("\n	Unable to read " + __dirname + "/gdrive.settings\n	Looks like you're running gdrive for the first time.\n	We're gonna need some credentials to connect to your Google Drive.\n	Please open the following URL in your browser:\n\n	" + url + "\n");
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      return rl.question('Enter the code here: ', function(code) {
        return oauth2Client.getToken(code, function(err, tokens) {
          if (err) {
            return console.log("ERR: " + err.stack);
          } else {
            auth_data.code = code;
            auth_data.tokens = tokens;
            console.log("TOKENS: " + (util.inspect(tokens)));
            oauth2Client.setCredentials(tokens);
            save_settings();
            rl.close();
            return callback();
          }
        });
      });
    }
  }
};

gdrive.auth(function() {
  var arg, args, pattern, _i, _j, _k, _len, _len1, _len2, _results, _results1, _results2;
  if (argv.u) {
    args = argv._.concat([argv.u]);
    console.log("Uploading [" + args + "]");
    _results = [];
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      _results.push(gdrive.uploadFile(arg, argv.f));
    }
    return _results;
  } else if (argv.l) {
    args = Array.isArray(argv.l) ? argv.l : [argv.l];
    _results1 = [];
    for (_j = 0, _len1 = args.length; _j < _len1; _j++) {
      arg = args[_j];
      pattern = arg.split('*');
      _results1.push(gdrive.list(pattern, function(files) {
        var file, _k, _len2, _results2;
        _results2 = [];
        for (_k = 0, _len2 = files.length; _k < _len2; _k++) {
          file = files[_k];
          _results2.push(console.log("Found: " + file.title + " [id: " + file.id + "]"));
        }
        return _results2;
      }));
    }
    return _results1;
  } else if (argv.d) {
    args = Array.isArray(argv.d) ? argv.d : [argv.d];
    _results2 = [];
    for (_k = 0, _len2 = args.length; _k < _len2; _k++) {
      arg = args[_k];
      pattern = arg.split('*');
      _results2.push(gdrive.deleteFiles(pattern));
    }
    return _results2;
  }
});
