// Test JavaScript vulnerable code
function vulnerableFunction(userInput) {
    // XSS vulnerability
    document.getElementById('output').innerHTML = userInput;
    
    // Prototype pollution
    Object.prototype.polluted = true;
    
    // Command execution risk
    eval(userInput);
    
    // Insecure deserialization
    JSON.parse(userInput);
}