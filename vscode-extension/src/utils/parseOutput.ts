// Placeholder for parseOutput utility

// This utility will be responsible for:
// 1. Taking the raw string output from the JAR.
// 2. Parsing it into a structured JavaScript object that the UI can easily consume.

const parseOutput = (output: string) => {
  // TODO: Implement output parsing logic
  console.log("parseOutput utility (TODO)", output);
  try {
    // Attempt to parse as JSON if the output is expected to be JSON directly
    return JSON.parse(output);
  } catch (error) {
    console.error("Failed to parse output as JSON:", error);
    // Handle non-JSON string output or return a specific error structure
    return { error: "Failed to parse output", rawOutput: output };
  }
};

export default parseOutput; 