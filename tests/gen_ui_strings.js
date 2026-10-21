// Regenerates the list of built-in interface text that the translate function is allowed to translate.
const fs = require('fs'), path = require('path'); global.window = {};
require(path.join(__dirname, '../js/i18n-dict.js'));
const arr = window.INAYA_DICT.map(r => r[0]);
fs.writeFileSync(path.join(__dirname, '../supabase/functions/translate/ui_strings.js'), '// Built-in interface text that may be translated. Regenerate with: node tests/gen_ui_strings.js\nexport const UI_STRINGS = ' + JSON.stringify(arr, null, 1) + ';\n');
console.log(arr.length + ' strings');
