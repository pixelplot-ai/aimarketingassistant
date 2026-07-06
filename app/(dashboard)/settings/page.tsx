import type { Metadata } from "next"

import { PageHeader } from "@/components/layout/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { getBrandProfile } from "@/features/brand/actions"
import { BrandProfileForm } from "@/features/brand/components/brand-profile-form"
import {
  getEnabledPlatforms,
  getPlatformConnections,
  getSettings,
} from "@/features/settings/actions"
import { AiSettingsForm } from "@/features/settings/components/ai-settings-form"
import { AppSettingsForm } from "@/features/settings/components/app-settings-form"
import { SocialConnections } from "@/features/settings/components/social-connections"
import { hasEnvFacebookPageToken } from "@/features/integrations/facebook/env-token"
import { hasEnvOpenAiApiKey } from "@/services/ai/env"
import {
  mapSettingsToAiForm,
  mapSettingsToAppForm,
} from "@/features/settings/lib/mappers"
import { getWorkspaceUserId } from "@/lib/auth/workspace"

export const metadata: Metadata = {
  title: "Settings",
}

type SettingsPageProps = {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const workspaceUserId = await getWorkspaceUserId()
  const { tab, connected, error: oauthError } = await searchParams
  const defaultTab =
    tab === "social" || tab === "ai" || tab === "app" || tab === "brand"
      ? tab
      : "brand"

  const [
    brandResult,
    settingsResult,
    platformsResult,
    connectionsResult,
  ] = await Promise.all([
    getBrandProfile(),
    getSettings(),
    getEnabledPlatforms(),
    getPlatformConnections(),
  ])

  const brandProfile = brandResult.success ? brandResult.data : null
  const settings = settingsResult.success ? settingsResult.data : null
  const platforms = platformsResult.success ? platformsResult.data : []
  const platformConnections = connectionsResult.success
    ? connectionsResult.data
    : []

  const loadErrors = [
    !brandResult.success ? brandResult.error : null,
    !settingsResult.success ? settingsResult.error : null,
    !platformsResult.success ? platformsResult.error : null,
    !connectionsResult.success ? connectionsResult.error : null,
  ].filter(Boolean)

  const openAiAvailable = hasEnvOpenAiApiKey()

  const aiDefaults = settings
    ? mapSettingsToAiForm(settings, { openAiAvailable })
    : mapSettingsToAiForm({
        id: "",
        user_id: workspaceUserId,
        created_at: "",
        updated_at: "",
        timezone: "UTC",
        date_format: "MM/dd/yyyy",
        default_post_status: "draft",
        default_platform_ids: [],
        text_ai_provider: "gemini",
        openai_model: "gpt-4o-mini",
        openai_temperature: 0.7,
        openai_max_tokens: 1024,
        gemini_model: "gemini-2.5-flash",
        gemini_image_size: "1024x1024",
        gemini_image_style: "natural",
        default_text_prompt: "",
        default_image_prompt: "",
        default_text_length_prompt: "",
      })

  const appDefaults = settings
    ? mapSettingsToAppForm(
        settings,
        platforms.map((platform) => platform.id),
      )
    : mapSettingsToAppForm(
        {
          id: "",
          user_id: workspaceUserId,
          created_at: "",
          updated_at: "",
          timezone: "UTC",
          date_format: "MM/dd/yyyy",
          default_post_status: "draft",
          default_platform_ids: [],
          text_ai_provider: "gemini",
          openai_model: "gpt-4o-mini",
          openai_temperature: 0.7,
          openai_max_tokens: 1024,
          gemini_model: "gemini-2.5-flash",
          gemini_image_size: "1024x1024",
          gemini_image_style: "natural",
          default_text_prompt: "",
          default_image_prompt: "",
          default_text_length_prompt: "",
        },
        platforms.map((platform) => platform.id),
      )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your brand profile, AI preferences, and application defaults."
      />

      {loadErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>{loadErrors.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      {oauthError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Connection failed: {decodeURIComponent(oauthError)}
          </AlertDescription>
        </Alert>
      ) : null}

      {connected ? (
        <Alert>
          <AlertDescription>
            Successfully connected {connected}.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="brand">Brand Profile</TabsTrigger>
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="social">Social Connections</TabsTrigger>
          <TabsTrigger value="app">Application</TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="mt-6">
          <BrandProfileForm userId={workspaceUserId} initialProfile={brandProfile} />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <AiSettingsForm
            defaultValues={aiDefaults}
            openAiAvailable={hasEnvOpenAiApiKey()}
          />
        </TabsContent>

        <TabsContent value="social" className="mt-6">
          <SocialConnections
            platforms={platformConnections}
            facebookEnvTokenAvailable={hasEnvFacebookPageToken()}
          />
        </TabsContent>

        <TabsContent value="app" className="mt-6">
          <AppSettingsForm defaultValues={appDefaults} platforms={platforms} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
