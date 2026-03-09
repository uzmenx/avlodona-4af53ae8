import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerPushNotifications } from "./lib/pushNotifications";

createRoot(document.getElementById("root")!).render(<App />);

// Register push notifications after app loads
registerPushNotifications();
