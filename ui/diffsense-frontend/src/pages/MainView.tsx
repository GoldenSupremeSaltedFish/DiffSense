import Toolbar from "../components/Toolbar";
import CommitList from "../components/CommitList";

const MainView = () => {
  return (
    <div style={{ padding: "10px", fontFamily: "sans-serif" }}>
      <Toolbar />
      <CommitList />
    </div>
  );
};

export default MainView; 