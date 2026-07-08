import { useAuth } from '../context/AuthContext';
import { basePathForRole } from '../config/roles';

// Returns '' for the Advanced portal and '/basic' for Basic-track roles.
// Prefix intra-app links/navigation with this so a shared page component keeps
// navigating within its own portal (e.g. `${basePath}/supervisor/reports`).
export default function useBasePath() {
  const { user } = useAuth();
  return basePathForRole(user?.role);
}
