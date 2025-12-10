const ProjectInferenceEngine = require('./plugin/analyzers/project-inference/engine');
const path = require('path');

async function run() {
    const engine = new ProjectInferenceEngine();
    const rootDir = path.resolve(__dirname); // Scan current repo
    
    console.log('Running Inference Engine...');
    const result = await engine.infer(rootDir);
    
    console.log('---------------------------------------------------');
    console.log('Inference Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------------------------------------------');
}

run().catch(console.error);
