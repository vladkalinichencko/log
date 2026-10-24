import { useLocation } from "react-router-dom";

export const useCurrentPath = () => decodeURIComponent(useLocation().pathname.slice(1));
