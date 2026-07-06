import type { ComponentType, SVGProps } from "react"

import { cn } from "@/lib/utils"

export type PlatformKey =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "wordpress"
  | "x"
  | "threads"
  | "pinterest"
  | "youtube"
  | "telegram"
  | "discord"

type IconProps = SVGProps<SVGSVGElement>

function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function LinkedInIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function XIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933zm-1.291 19.497h2.039L6.486 3.24H4.298l13.312 17.41z" />
    </svg>
  )
}

function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.918-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.15-3.02.74-.63.66-.94 1.57-.88 2.48.08 1.26.84 2.41 2.02 2.94 1.06.46 2.28.44 3.32-.01.96-.4 1.73-1.18 2.07-2.15.12-.41.18-.85.17-1.28-.01-5.16-.01-10.32-.01-15.48z" />
    </svg>
  )
}

function YouTubeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function PinterestIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  )
}

function ThreadsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.81-.507-1.156-1.567-1.99-3.029-2.409-.487 1.073-1.365 2.062-2.702 2.675-.896.404-1.956.604-3.152.604-1.333 0-2.404-.36-3.185-1.07-.896-.82-1.346-2.018-1.306-3.465.08-2.937 2.173-4.927 5.119-4.991 1.062-.021 2.008.136 2.818.403.262-1.024.672-1.878 1.207-2.533-1.128-.413-2.443-.632-3.908-.632-4.605 0-7.641 2.912-7.756 7.371-.05 2.019.588 3.728 1.798 4.926 1.154 1.142 2.803 1.715 4.909 1.715.683 0 1.312-.06 1.877-.18.403-.088.777-.21 1.12-.363-.302.927-.777 1.668-1.402 2.185 1.208.694 2.692 1.053 4.409 1.053 2.156 0 3.969-.594 5.394-1.765 1.563-1.29 2.405-3.185 2.505-5.632.098-2.362-.548-4.248-1.919-5.604-1.297-1.282-3.155-1.934-5.523-1.934-1.274 0-2.416.24-3.395.714-.979.475-1.743 1.14-2.272 1.978-.529.838-.796 1.804-.796 2.877 0 1.073.267 2.039.796 2.877.529.838 1.293 1.503 2.272 1.978.979.474 2.121.714 3.395.714 1.274 0 2.416-.24 3.395-.714.979-.475 1.743-1.14 2.272-1.978.529-.838.796-1.804.796-2.877 0-1.073-.267-2.039-.796-2.877-.529-.838-1.293-1.503-2.272-1.978-.979-.474-2.121-.714-3.395-.714z" />
    </svg>
  )
}

function WordPressIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.922-.067-.892 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.584-.03-.661.855-.075.885 0 0 .54.075 1.125.105l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.92-.065-.89 0 0-1.755.135-2.88.135-.202 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.835-.046-.003-.091-.009-.141-.009-1.064 0-1.818.925-1.818 1.919 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.403-2.325.607-3.582.607M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0" />
    </svg>
  )
}

function TelegramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function DiscordIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.106c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  )
}

function GenericPlatformIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

const PLATFORM_ICONS: Record<
  string,
  ComponentType<IconProps>
> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  x: XIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  threads: ThreadsIcon,
  wordpress: WordPressIcon,
  telegram: TelegramIcon,
  discord: DiscordIcon,
}

export function normalizePlatformKey(key: string): string {
  return key.trim().toLowerCase()
}

export function getPlatformBrandStyle(platformKey: string): {
  iconBg: string
  iconText: string
  chipBg: string
  chipText: string
  chipBorder: string
  ring: string
} {
  switch (normalizePlatformKey(platformKey)) {
    case "facebook":
      return {
        iconBg: "bg-[#1877F2]",
        iconText: "text-white",
        chipBg: "bg-[#1877F2]/10",
        chipText: "text-[#1877F2] dark:text-[#6BA3FF]",
        chipBorder: "border-[#1877F2]/25",
        ring: "ring-[#1877F2]/20",
      }
    case "instagram":
      return {
        iconBg: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
        iconText: "text-white",
        chipBg: "bg-[#DD2A7B]/10",
        chipText: "text-[#C13584] dark:text-[#F77737]",
        chipBorder: "border-[#DD2A7B]/25",
        ring: "ring-[#DD2A7B]/20",
      }
    case "linkedin":
      return {
        iconBg: "bg-[#0A66C2]",
        iconText: "text-white",
        chipBg: "bg-[#0A66C2]/10",
        chipText: "text-[#0A66C2] dark:text-[#5BA4F5]",
        chipBorder: "border-[#0A66C2]/25",
        ring: "ring-[#0A66C2]/20",
      }
    case "x":
      return {
        iconBg: "bg-neutral-900 dark:bg-neutral-100",
        iconText: "text-white dark:text-neutral-900",
        chipBg: "bg-neutral-500/10",
        chipText: "text-neutral-800 dark:text-neutral-200",
        chipBorder: "border-neutral-500/25",
        ring: "ring-neutral-500/20",
      }
    case "tiktok":
      return {
        iconBg: "bg-neutral-900 dark:bg-neutral-100",
        iconText: "text-white dark:text-neutral-900",
        chipBg: "bg-neutral-500/10",
        chipText: "text-neutral-800 dark:text-neutral-200",
        chipBorder: "border-neutral-500/25",
        ring: "ring-neutral-500/20",
      }
    case "youtube":
      return {
        iconBg: "bg-[#FF0000]",
        iconText: "text-white",
        chipBg: "bg-[#FF0000]/10",
        chipText: "text-[#FF0000] dark:text-[#FF6666]",
        chipBorder: "border-[#FF0000]/25",
        ring: "ring-[#FF0000]/20",
      }
    case "pinterest":
      return {
        iconBg: "bg-[#E60023]",
        iconText: "text-white",
        chipBg: "bg-[#E60023]/10",
        chipText: "text-[#E60023] dark:text-[#FF667A]",
        chipBorder: "border-[#E60023]/25",
        ring: "ring-[#E60023]/20",
      }
    case "threads":
      return {
        iconBg: "bg-neutral-900 dark:bg-neutral-100",
        iconText: "text-white dark:text-neutral-900",
        chipBg: "bg-neutral-500/10",
        chipText: "text-neutral-800 dark:text-neutral-200",
        chipBorder: "border-neutral-500/25",
        ring: "ring-neutral-500/20",
      }
    case "wordpress":
      return {
        iconBg: "bg-[#21759B]",
        iconText: "text-white",
        chipBg: "bg-[#21759B]/10",
        chipText: "text-[#21759B] dark:text-[#5BAFD4]",
        chipBorder: "border-[#21759B]/25",
        ring: "ring-[#21759B]/20",
      }
    case "telegram":
      return {
        iconBg: "bg-[#26A5E4]",
        iconText: "text-white",
        chipBg: "bg-[#26A5E4]/10",
        chipText: "text-[#26A5E4] dark:text-[#6BC5F0]",
        chipBorder: "border-[#26A5E4]/25",
        ring: "ring-[#26A5E4]/20",
      }
    case "discord":
      return {
        iconBg: "bg-[#5865F2]",
        iconText: "text-white",
        chipBg: "bg-[#5865F2]/10",
        chipText: "text-[#5865F2] dark:text-[#9BA5FF]",
        chipBorder: "border-[#5865F2]/25",
        ring: "ring-[#5865F2]/20",
      }
    default:
      return {
        iconBg: "bg-muted",
        iconText: "text-muted-foreground",
        chipBg: "bg-muted/60",
        chipText: "text-foreground",
        chipBorder: "border-border",
        ring: "ring-border",
      }
  }
}

interface PlatformIconProps {
  platformKey: string
  className?: string
  size?: "xs" | "sm" | "md" | "lg"
}

const ICON_SIZES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const

const BADGE_SIZES = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
} as const

export function PlatformIcon({
  platformKey,
  className,
  size = "md",
}: PlatformIconProps) {
  const key = normalizePlatformKey(platformKey)
  const Icon = PLATFORM_ICONS[key] ?? GenericPlatformIcon

  return <Icon className={cn(ICON_SIZES[size], className)} />
}

interface PlatformIconBadgeProps {
  platformKey: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function PlatformIconBadge({
  platformKey,
  size = "md",
  className,
}: PlatformIconBadgeProps) {
  const styles = getPlatformBrandStyle(platformKey)
  const iconSize = size === "lg" ? "md" : size === "md" ? "sm" : "xs"

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset",
        BADGE_SIZES[size],
        styles.iconBg,
        styles.iconText,
        styles.ring,
        className,
      )}
    >
      <PlatformIcon platformKey={platformKey} size={iconSize} />
    </span>
  )
}

interface PlatformChipProps {
  platformKey: string
  label?: string
  className?: string
}

export function PlatformChip({
  platformKey,
  label,
  className,
}: PlatformChipProps) {
  const styles = getPlatformBrandStyle(platformKey)
  const displayName = label ?? platformKey

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        styles.chipBg,
        styles.chipText,
        styles.chipBorder,
        className,
      )}
    >
      <PlatformIcon platformKey={platformKey} size="xs" />
      <span className="truncate">{displayName}</span>
    </span>
  )
}

interface PlatformOptionProps {
  platformKey: string
  displayName: string
  description?: string
  selected?: boolean
  className?: string
}

export function PlatformOption({
  platformKey,
  displayName,
  description,
  selected = false,
  className,
}: PlatformOptionProps) {
  const styles = getPlatformBrandStyle(platformKey)

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        className,
      )}
    >
      <PlatformIconBadge platformKey={platformKey} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {description ? (
          <p className="truncate text-xs text-muted-foreground capitalize">
            {description}
          </p>
        ) : null}
      </div>
      {selected ? (
        <span
          className={cn("ml-auto size-2 shrink-0 rounded-full", styles.iconBg)}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
