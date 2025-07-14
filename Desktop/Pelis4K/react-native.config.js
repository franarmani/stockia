module.exports = {
  dependencies: {
    'react-native-google-cast': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-google-cast/android',
          packageImportPath: 'import io.invertase.googlecast.RNGoogleCastPackage;',
        },
      },
    },
  },
};
