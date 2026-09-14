export function friendlyAuthError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  const code = e?.code ?? e?.message ?? '';
  if (code === 'configuration_missing') return 'Cloud sign-in is not configured yet. Follow docs/supabase-setup.md.';
  if (code === 'invalid_credentials') return 'The email or password is incorrect.';
  if (code === 'email_not_confirmed') return 'Please verify your email before signing in.';
  if (['user_already_exists', 'email_exists'].includes(code)) return 'An account may already use this email. Try signing in or resetting your password.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 12 characters.';
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier', 'invalid_grant'].includes(code)) return 'This link expired or belongs to another device. Request a new link on this device.';
  if (['over_request_rate_limit', 'over_email_send_rate_limit'].includes(code)) return 'Too many attempts. Please wait before trying again.';
  if (/fetch|network|offline|timeout/i.test(code)) return 'Cannot connect right now. Check your connection and try again.';
  if (code === 'session_expired') return 'Your session expired. Connect to the internet and sign in again.';
  return 'The request could not be completed. Please try again when connected.';
}
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const validPassword = (password: string) => password.length >= 12 && password.length <= 128;
