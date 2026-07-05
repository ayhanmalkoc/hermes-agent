import { ProfilesView } from './profiles'

interface AgentsProfileViewProps {
  onClose: () => void
}

export function AgentsProfileView({ onClose }: AgentsProfileViewProps) {
  return <ProfilesView onClose={onClose} showTeamLinks title="Agents" />
}
