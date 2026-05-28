import { Routes, Route } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Overview } from "@/pages/Overview";
import { PortfolioPage } from "@/pages/PortfolioPage";
import { WatchlistPage } from "@/pages/WatchlistPage";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Overview />} />
          <Route path="/stocks" element={<PortfolioPage portfolio="stocks" />} />
          <Route path="/etfs" element={<PortfolioPage portfolio="etfs" />} />
          <Route path="/retirement-stocks" element={<PortfolioPage portfolio="retirement_stocks" />} />
          <Route path="/retirement-etfs" element={<PortfolioPage portfolio="retirement_etfs" />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Layout>
      <AnimatedRoutes />
    </Layout>
  );
}
