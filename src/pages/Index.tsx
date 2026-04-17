import { Navigate } from "react-router-dom";

// Index now redirects to landing — full app lives under /app
const Index = () => <Navigate to="/" replace />;

export default Index;
