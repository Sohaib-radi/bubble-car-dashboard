// Native app requests (iOS/Android) aren't subject to browser CORS at all,
// but this keeps the API usable from Expo web / any future browser client
// too. Restrict via MOBILE_APP_ORIGIN once the app has a fixed origin;
// defaults to "*" since native requests don't send an Origin header anyway.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': process.env.MOBILE_APP_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
