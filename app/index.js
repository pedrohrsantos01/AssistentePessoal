if (process.env.EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS === '1' || process.env.EXPO_PUBLIC_RITMO_HTTP_HARNESS === '1') {
  require('./harness/index.ts');
} else {
  require('expo-router/entry');
}
