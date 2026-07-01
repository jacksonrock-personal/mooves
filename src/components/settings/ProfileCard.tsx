'use client'

// Screen 10: Profile section — implementation pending

interface ProfileCardProps {
  displayName: string | null
  phone: string
  avatarUrl?: string | null
  onNameSave: (name: string) => void
  onAvatarChange: () => void
}

export default function ProfileCard({ displayName, phone }: ProfileCardProps) {
  return (
    <div className="font-sans text-center py-6">
      <div className="w-20 h-20 rounded-full bg-mooves-purple mx-auto flex items-center justify-center text-white text-2xl font-bold">
        {displayName?.[0]?.toUpperCase() ?? '?'}
      </div>
      <p className="mt-3 font-semibold text-lg">{displayName}</p>
      <p className="text-sm text-text-secondary">{phone}</p>
    </div>
  )
}
