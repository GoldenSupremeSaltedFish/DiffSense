import React from "react";

const fakeData = [
  {
    id: "c1",
    message: "Fix login bug",
    files: [
      {
        path: "src/LoginService.java",
        methods: ["validateUser"],
        tests: ["testLoginSuccess"],
      },
    ],
  },
  {
    id: "c2",
    message: "Add feature X",
    files: [
      {
        path: "src/FeatureX.java",
        methods: ["runFeature"],
        tests: ["testFeatureX"],
      },
    ],
  },
];

const CommitList = () => {
  return (
    <div>
      {fakeData.map((commit) => (
        <div
          key={commit.id}
          style={{
            borderBottom: "1px solid #ccc",
            marginBottom: "10px",
            paddingBottom: "10px",
          }}
        >
          <strong>{commit.message}</strong>
          {commit.files.map((f, i) => (
            <div key={i} style={{ marginLeft: "20px" }}>
              📄 {f.path}
              {f.methods.map((m, j) => (
                <div key={j} style={{ marginLeft: "20px" }}>
                  🧠 {m}
                  <div style={{ marginLeft: "20px", color: "green" }}>
                    ✅ {f.tests.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default CommitList; 