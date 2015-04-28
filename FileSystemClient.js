var FileSystemClient = (function () {
    var requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

    function FileSystemClient(requstedSpace, storageType) {
        if (!CheckIfFileSystemIsSupported()) return;;
        this.space = requstedSpace;
        this.storageType = storageType;
        this.fs = null;
        this.init();
    }

    FileSystemClient.prototype.init = function () {
        var self = this;

        navigator.webkitPersistentStorage.requestQuota(
            this.space, // Requsted space
            function (grantedBytes) {
                window.webkitRequestFileSystem(
                    window.PERSISTENT, // Storage Type
                    grantedBytes, // Granted space
                    function (fileSystem) { // File System
                        self.fs = fileSystem;
                    }, onError);

            },
            function (e) {
                console.log('Error', e);
            }
        );
    };

    FileSystemClient.prototype.createFile = function (fileName, folderPath, contentAsString, options, callback) {
        var extension = (options && options.extension) ? options.extension : 'json', // Default Extension
            path = (folderPath[folderPath.length - 1] == '/') ? folderPath : folderPath + '/',
            exclusive = (options && options.exclusive) ? options.exclusive : true;
        this.fs.root.getFile(path + fileName + '.' + extension,
            { create: true, exclusive: exclusive }, // create file if it does not exist already
            function (fileEntry) { // success callback function
                fileEntry.createWriter(function (fileWriter) { // create Writer
                    fileWriter.onwrite = function (e) { // when file is fully writen
                        callback({ success: 'File ' + fileName + '.' + extension + ' succesfully created!' });
                    };
                    fileWriter.onerror = function (e) { // if there is error on write 
                        callback({ error: 'Write failed: ' + e.toString() });
                    };
                    var b = new Blob([contentAsString]); // create Blob from content
                    fileWriter.write(b); // write it to file
                }, onError); // handle fileEntry callback
            }, onError); // handle getFile callback
    };

    FileSystemClient.prototype.readFile = function (fileName, options, callback) {
        var extension = (options && options.extension) ? options.extension : 'json'; // Default Extension
        this.fs.root.getFile(fileName + '.' + extension, {}, function (fileEntry) {
            // Obtain the File object representing the FileEntry.
            // Use FileReader to read its contents.
            fileEntry.file(function (file) {
                var reader = new FileReader();
                reader.onloadend = function (e) {
                    callback({ success: this.result });
                };
                reader.readAsText(file); // Read the file as plaintext.
            }, onError);
        }, onError);
    };

    FileSystemClient.prototype.removeFile = function (fileName, options, callback) {
        this.fs.root.getFile(fileName + '.json', {}, function (fileEntry) {
            fileEntry.remove(function () {
                callback({ success: 'File ' + fileName + ' removed.' });
            }, onError);
        }, onError);
    };

    FileSystemClient.prototype.readDir = function (dirPath, options, callback) {
        if (dirPath == '' || dirPath == './' || dirPath == '/') readDir(this.fs.root); // if directory path is default api path -> root element
        else {
            this.fs.root.getDirectory(dirPath, {}, function (dirEntry) { // get directory
                readDir(dirEntry);
            }, onError);
        }

        function readDir(dir) {
            var dirReader = dir.createReader(); // create reader from directory
            var entries = []; // all results

            var readEntries = function () { // recursive read of all files in directory
                dirReader.readEntries(function (results) {
                    if (!results.length) {// if there is no more files return all files
                        if (options && options.filter) callback({ files: entries.filter(function (el) { return el[options.filter] }).sort(sortByName) }); // if there is filter - isDirectory and isFile
                        else callback({ files: entries.sort(sortByName) }); 
                    } else { // if not search for more
                        entries = entries.concat(results);
                        readEntries();
                    }
                }, onError); // handle readEntries Error
            }
            readEntries();
        }

        function sortByName(a, b) {
            return a.name.localeCompare(b.name);
        };
    };

    FileSystemClient.prototype.createDir = function (dirName, options, callback) {
        if (options && options.chainedDirs) {
            // TODO
        } else {
            createDir(this.fs.root);
        }

        function createDir(dirEntry) {
            dirEntry.getDirectory(dirName, { create: true, exclusive: true }, function (dirEntry) {
                callback({ success: 'Directory ' + dirEntry.name + ' successfully created!' });
            }, onError);
        }

    };

    FileSystemClient.prototype.removeDir = function (dirPath, options, callback) {
        if (dirPath == '' || dirPath == './' || dirPath == '/') throw new Error('Root Directory can not be removed!'); // choose root directory

        this.fs.root.getDirectory(dirPath, {}, function (dirEntry) { // getDirectory
            if (options && options.includeFiles) { // remove all files in directory and all sub directories
                dirEntry.removeRecursively(function () {
                    console.log({ success: 'Directory ' + dirEntry.name + ' and all files successfully removed!' });
                }, onError);
            } else {
                dirEntry.remove(function () { // remove only empty directories
                    callback({ success: 'Directory ' + dirEntry.name + ' successfully removed!' });
                }, onError);
            }
        }, onError); // handle getDirectory Error
    };


    FileSystemClient.prototype.removeAllFilesFromDir = function (dirPath, callback) {
        var self = this;
        self.readDir(dirPath, {},function (result) {
            for (var i = 0; i < result.files.length; i++) {
                var fileName = result.files[i].fullPath
                if (result.files[i].isFile) {
                    self.removeFile(fileName.slice(0, fileName.lastIndexOf('.')), {}, function (data) { console.log(data) });
                } else if (result.files[i].isDirectory) {
                    self.removeDir(fileName, { includeFiles: true }, function (data) { console.log(data) });
                }
            }
        });
    }

    FileSystemClient.prototype.haveFileSystem = function () {
        if (!this.fs) return false
        else return true
    };

    function CheckIfFileSystemIsSupported() {
        if (!requestFileSystem) {
            alert('Your browser does not support FileSystem.. Please use Chrome!');
            return false
        }
        return true
    };

    function onError(err) {
        var msg = 'Error: ';
        switch (err.code) {
            case FileError.NOT_FOUND_ERR:
                msg += 'File or directory not found';
                break;
            case FileError.SECURITY_ERR:
                msg += 'Insecure or disallowed operation';
                break;
            case FileError.ABORT_ERR:
                msg += 'Operation aborted';
                break;
            case FileError.NOT_READABLE_ERR:
                msg += 'File or directory not readable';
                break;
            case FileError.ENCODING_ERR:
                msg += 'Invalid encoding';
                break;
            case FileError.NO_MODIFICATION_ALLOWED_ERR:
                msg += 'Cannot modify file or directory';
                break;
            case FileError.INVALID_STATE_ERR:
                msg += 'Invalid state';
                break;
            case FileError.SYNTAX_ERR:
                msg += 'Invalid line-ending specifier';
                break;
            case FileError.INVALID_MODIFICATION_ERR:
                msg += 'Invalid modification';
                break;
            case FileError.QUOTA_EXCEEDED_ERR:
                msg += 'Storage quota exceeded';
                break;
            case FileError.TYPE_MISMATCH_ERR:
                msg += 'Invalid filetype';
                break;
            case FileError.PATH_EXISTS_ERR:
                msg += 'File or directory already exists at specified path';
                break;
            default:                msg += 'Unknown Error';
                break;
        };
        console.log(msg);
    }

    return FileSystemClient;
})();