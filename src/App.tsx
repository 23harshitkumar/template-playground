import { useEffect, useRef, useState } from "react";
import { App as AntdApp, Layout, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { Routes, Route, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import tour from "./components/Tour";
import LearnNow from "./pages/LearnNow";
import useAppStore from "./store/store";
import LearnContent from "./components/Content";
import MainContainer from "./pages/MainContainer";
import PlaygroundSidebar from "./components/PlaygroundSidebar";
import "./styles/App.css";
import AIConfigPopup from "./components/AIConfigPopup";

const { Content } = Layout;

const App = () => {
  const APP_INIT_TIMEOUT_MS = 20000;

  const navigate = useNavigate();
  const init = useAppStore((state) => state.init);
  const loadFromLink = useAppStore((state) => state.loadFromLink);
  const { isAIConfigOpen, setAIConfigOpen } =
    useAppStore((state) => ({
      isAIConfigOpen: state.isAIConfigOpen,
      setAIConfigOpen: state.setAIConfigOpen,
    }));
  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const textColor = useAppStore((state) => state.textColor);
  const [loading, setLoading] = useState(true);
  const didInitialize = useRef(false);
  const [searchParams] = useSearchParams();


  useEffect(() => {
    if (didInitialize.current) {
      return;
    }
    didInitialize.current = true;

    const runWithTimeout = async (task: Promise<void>, timeoutMs: number): Promise<void> => {
      await Promise.race([
        task,
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`App initialization timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    };

    const initializeApp = async () => {
      try {
        setLoading(true);
        // Prioritize hash for new links, fallback to searchParams for old links
        let compressedData: string | null = null;
        if (window.location.hash.startsWith("#data=")) {
          compressedData = window.location.hash.substring(6);
        } else {
          compressedData = new URLSearchParams(window.location.search).get("data");
        }
        if (compressedData) {
          await runWithTimeout(loadFromLink(compressedData), APP_INIT_TIMEOUT_MS);
          if (window.location.pathname !== "/") {
            navigate("/", { replace: true });
          }
        } else {
          await runWithTimeout(init(), APP_INIT_TIMEOUT_MS);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setLoading(false);
      }
    };
    void initializeApp();
  }, [init, loadFromLink, navigate]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      .ant-collapse-header {
        color: ${textColor} !important;
      }
      .ant-collapse-content {
        background-color: ${backgroundColor} !important;
      }
      .ant-collapse-content-active {
        background-color: ${backgroundColor} !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [backgroundColor, textColor]);

  useEffect(() => {
    const startTour = async () => {
      try {
        await tour.start();
        localStorage.setItem("hasVisited", "true");
      } catch (error) {
        console.error("Tour failed to start:", error);
      }
    };

    const showTour = searchParams.get("showTour") === "true";
    if (showTour || !localStorage.getItem("hasVisited")) {
      void startTour();
    }
  }, [searchParams]);

  // Set data-theme attribute on initial load and when theme changes
  useEffect(() => {
    const theme = backgroundColor === "#121212" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, [backgroundColor]);

  return (
    <AntdApp>
      <Layout style={{ height: "100vh" }}>
        <Navbar />
        <Layout
          className="app-layout"
          style={{
            backgroundColor,
            height: "calc(100vh - 64px)",
            marginTop: "64px",
            overflow: "hidden",
          }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <PlaygroundSidebar />
                  <Content style={{ marginLeft: "64px" }}>
                    {loading ? (
                      <div className="app-content-loading">
                        <Spinner />
                      </div>
                    ) : (
                      <div className="app-main-content">
                        <MainContainer />
                      </div>
                    )}
                  </Content>
                  <AIConfigPopup
                    isOpen={isAIConfigOpen}
                    onClose={() => setAIConfigOpen(false)}
                  />
                </>
              }
            />
            <Route path="/learn" element={<LearnNow />}>
              <Route path="intro" element={<LearnContent file="intro.md" />} />
              <Route path="module1" element={<LearnContent file="module1.md" />} />
              <Route path="module2" element={<LearnContent file="module2.md" />} />
              <Route path="module3" element={<LearnContent file="module3.md" />} />
            </Route>
          </Routes>
        </Layout>
      </Layout>
    </AntdApp>
  );
};

const Spinner = () => (
  <div className="app-spinner-container">
    <Spin
      indicator={<LoadingOutlined style={{ fontSize: 42, color: "#19c6c7" }} spin />}
    />
  </div>
);

export default App;