import { useAuth } from '../../context/AuthContext';

// Whether the current account may use the Initiatives feature.
// Access is role-based: the ASG roles (asg1 / asg2) only — mirroring the
// backend `requireInitiativeAccess` gate (the backend 403 is the real guard;
// this just hides the nav button and redirects away from the route).
// The role is already present on the auth user (login + /refresh both carry
// it), so no extra request is needed.
const ASG_ROLES = ['asg1', 'asg2'];

export function useInitiativeAccess() {
  const { user, loading } = useAuth();
  return { allowed: !!user && ASG_ROLES.includes(user.role), loading };
}
