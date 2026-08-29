module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Metro no reconoce los .sql, y Drizzle genera las migraciones en ese
    // formato. Sin este plugin la app falla al importarlas.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
