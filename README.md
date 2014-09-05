gdrive
=============

Node.js Google Drive client based on the official API

## Usage
```
Examples:
  ./gdrive.js -f backup -u file_1 another2 /path/other*.txt    Upload all matching files to the 'backup' folder
  ./gdrive.js -l 'file'                                        List all files that have 'file' in their names
  ./gdrive.js -d '_1' -d 'other'                               Delete files that have '_1' OR 'other' in their names
  ./gdrive.js -d 'another*file'                                Delete files that have both 'another' AND 'file' in their names.
```

```
Options:
  -u, --upload  upload files                                                                       
  -f, --folder  folder to upload files to                                                          
  -d, --delete  delete files matching a pattern (in any folder). Multiple -d arguments are allowed.
  -l, --list    list files matching a pattern (in any folder). Multiple -l arguments are allowed. 
```

## Installation
You will need a node.js and npm packed manager to install it:

```
git clone https://github.com/serjrd/gdrive.git gdrive
cd gdrive && npm install
```