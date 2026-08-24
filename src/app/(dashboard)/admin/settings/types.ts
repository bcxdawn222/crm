export interface SettingsFormValues {
  systemName: string
  companyName: string
}

export interface SettingsResponse {
  success: true
  data: SettingsFormValues
}
