var fs = require('fs');
var getDirName = require('path').dirname;
var os = require('os');
var path = require('path');
var request = require('request');
var unzipper = require('unzipper');

function mkDirByPathSync(targetDir) {
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    return targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(parentDir, childDir);
        try {
            fs.mkdirSync(curDir);
        } catch (err) {
            if (err.code === 'EEXIST') {
                return curDir;
            }
        }
        return curDir;
    }, initDir);
}

async function downloadAndUnzipExtension(url, dest, cb) {
    request(url).pipe(unzipper.Parse()).on('entry', function (entry) {
        if (entry.path.startsWith('extension/')) {
            var newPath = path.resolve(dest, entry.path.slice(10));
            mkDirByPathSync(getDirName(newPath));
            entry.pipe(fs.createWriteStream(newPath));
        } else if (entry.path.endsWith('extension.vsixmanifest')) {
            var newPath = path.resolve(dest, entry.path.slice(9));
            mkDirByPathSync(getDirName(newPath));
            entry.pipe(fs.createWriteStream(newPath));
        } else {
            entry.autodrain();
        }
    }).on('finish', cb);
}

function installVscodeYamlExtension() {
    const version = '0.4.0';
    const extensionPath = path.join(os.homedir(), `.vscode/extensions/redhat.vscode-yaml-${version}`);
    console.log(`extensionPath: ${extensionPath}`);
    const url = `https://github.com/redhat-developer/vscode-yaml/releases/download/0.4.0/redhat.vscode-yaml-0.4.0.vsix`;
    downloadAndUnzipExtension(url, extensionPath, function() {
        var exec = require('child_process').exec;
        exec(`ls ${extensionPath}`, function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
            }
        });
    });
}

installVscodeYamlExtension();