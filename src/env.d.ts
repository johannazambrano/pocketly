/** Versione dell'app: major.minor da package.json, poi il numero di commit (vedi `appVersion` in vite.config.ts). */
declare const __APP_VERSION__: string
/** Commit corto da cui è fatta la build ('' senza git). */
declare const __APP_COMMIT__: string
/** Ora della build (ISO), per riconoscere quale versione gira su un dispositivo. */
declare const __APP_BUILT_AT__: string
