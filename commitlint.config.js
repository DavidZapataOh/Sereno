module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Los mensajes de fusión no siguen el formato convencional por diseño: los
  // genera git. Sin esta excepción, `git merge` falla y deja la fusión a medias.
  // Cubre tanto «Merge branch …» como «Merge: …»: el espacio solo no basta.
  ignores: [(mensaje) => /^(Merge|Revert)\b/.test(mensaje)],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore', 'build', 'ci', 'revert'],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};
