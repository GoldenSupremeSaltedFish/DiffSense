import React from "react";

const Toolbar = () => {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
      <select>
        <option>master</option>
        <option>dev</option>
      </select>
      <select>
        <option>Last 3 commits</option>
        <option>Today</option>
        <option>Custom Range</option>
      </select>
      <button onClick={() => alert("run analysis")}>Analyze</button>
    </div>
  );
};

export default Toolbar; 