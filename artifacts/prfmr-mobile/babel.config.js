module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          unstable_transformImportMeta: true,
          reactCompiler: {
            sources: (filename) => {
              return !filename.includes("nutrition.tsx");
            },
          },
        },
      ],
    ],
  };
};
