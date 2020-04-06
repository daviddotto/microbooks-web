// Use this file to change site configuration.

module.exports = {
  // Site name used in <title>
  siteName: 'Site name',

  // Default port the site runs on
  port: '3000',

  // Automatically stores form data, and send to all views
  useAutoStoreData: 'true',

  // Force HTTP to redirect to HTTPS on production
  useHttps: 'true',

  // Enable or disable Browser Sync
  useBrowserSync: 'true',

  firebaseConfig: {
    apiKey: process.env.FB__API_KEY,
    authDomain: process.env.FB__AUTH_ADMIN,
    databaseURL: process.env.FB__DB_URL,
    projectId: process.env.FB__PROJECT_ID,
    storageBucket: process.env.FB__STORAGE_BUCKET,
    messagingSenderId: process.env.FB__SENDER_ID,
    appId: process.env.FB__APP_ID,
    measurementId: process.env.FB__MEASUREMENT_ID
  }
}
