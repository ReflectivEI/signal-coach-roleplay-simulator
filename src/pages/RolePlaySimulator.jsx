
import { useEffect } from "react";

export default function RolePlaySimulatorRedirect() {
  useEffect(() => {
    window.location.replace("https://rps.reflectiv-ai.com/");
  }, []);
  return null;
}
