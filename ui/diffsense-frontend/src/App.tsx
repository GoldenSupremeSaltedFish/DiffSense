import { ErrorBoundary } from "react-error-boundary";
import MainView from "./pages/MainView";

function ErrorFallback({error}: {error: Error}) {
  console.error('App Error Boundary triggered:', error);
  
  return (
    <div style={{ 
      padding: "20px", 
      color: "red", 
      border: "2px solid red",
      backgroundColor: "white",
      margin: "10px"
    }}>
      <h2>应用错误</h2>
      <p>错误信息: {error.message}</p>
      <details>
        <summary>详细信息</summary>
        <pre>{error.stack}</pre>
      </details>
    </div>
  );
}

const App = () => {
  console.log('App component rendering...');
  
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={(error: Error, errorInfo: any) => {
        console.error('App Error:', error, errorInfo);
      }}
    >
      <div className="app-container" style={{
        width: "100%",
        height: "100%",
        padding: "2px"
      }}>
        <MainView />
      </div>
    </ErrorBoundary>
  );
};

export default App;