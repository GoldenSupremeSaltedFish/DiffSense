// Test vulnerable JavaScript code for CVE detection

// XSS vulnerability - CVE-2023-XXXX
function handleUserInput(userInput) {
    // UNSAFE: Direct DOM manipulation with user input
    document.getElementById('output').innerHTML = userInput;
    
    // SAFE: Should use textContent or proper sanitization
    // document.getElementById('output').textContent = userInput;
}

// Prototype pollution - CVE-2022-XXXX  
function mergeObjects(target, source) {
    // UNSAFE: Direct property assignment without validation
    for (let key in source) {
        target[key] = source[key];
    }
    
    // SAFE: Should validate keys and prevent __proto__ access
    // if (!key.startsWith('__') && key !== 'constructor') {
    //     target[key] = source[key];
    // }
}

// Command injection - CVE-2021-XXXX
const { exec } = require('child_process');
function runCommand(userCommand) {
    // UNSAFE: Direct command execution with user input
    exec('ls ' + userCommand, (error, stdout, stderr) => {
        console.log(stdout);
    });
    
    // SAFE: Should use argument arrays or input validation
    // execFile('ls', [userCommand], ...)
}

// Path traversal - CVE-2020-XXXX
const fs = require('fs');
function readFile(filename) {
    // UNSAFE: Direct file path concatenation
    const fullPath = './uploads/' + filename;
    fs.readFile(fullPath, 'utf8', (err, data) => {
        console.log(data);
    });
    
    // SAFE: Should validate and sanitize file paths
    // const sanitized = path.basename(filename);
    // const fullPath = path.join('./uploads', sanitized);
}

// Insecure random - CVE-2019-XXXX
function generateToken() {
    // UNSAFE: Using Math.random() for security tokens
    return Math.random().toString(36).substring(2);
    
    // SAFE: Should use crypto.randomBytes()
    // return crypto.randomBytes(32).toString('hex');
}

module.exports = {
    handleUserInput,
    mergeObjects, 
    runCommand,
    readFile,
    generateToken
};