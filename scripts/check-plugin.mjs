/**
 * Validates the WordPress plugin without a PHP runtime.
 *
 * There is no `php` binary on the machines this project is developed on, and a
 * syntax error in the plugin white-screens a live WordPress admin. This parses
 * the file, then cross-checks that every hooked callback actually exists — a
 * typo'd callback name is silent in PHP, it simply never runs.
 */
import { readFileSync } from "node:fs";
import Engine from "php-parser";

const file = "wordpress/ilovedurban-headless-cms.php";
const source = readFileSync(file, "utf8");

try {
  new Engine({ parser: { suppressErrors: false } }).parseCode(source, file);
} catch (err) {
  console.error(`[plugin] SYNTAX ERROR: ${err.message}`);
  process.exit(1);
}

const defined = new Set([...source.matchAll(/^function\s+(\w+)\s*\(/gm)].map((m) => m[1]));

/*
 * Only the argument positions that WordPress treats as a callable. Matching any
 * quoted ild_* string picks up option names, meta keys and form field names too,
 * which are not functions and must not be flagged.
 */
const CALLBACK_PATTERNS = [
  // add_action( 'hook', 'callback' ) / add_filter( ... )
  /add_(?:action|filter)\(\s*['"][^'"]+['"]\s*,\s*['"](ild_\w+)['"]/g,
  // 'callback' => 'name', as used by register_rest_route
  /['"]callback['"]\s*=>\s*['"](ild_\w+)['"]/g,
  // add_meta_box( id, title, callback, ... ) — the ild_ prefix is required
  // because the title argument can itself contain commas.
  /add_meta_box\((?:[^;]*?)['"](ild_\w+)['"]/g,
  // add_menu_page( ..., capability, slug, callback, ... )
  /add_(?:menu|submenu)_page\((?:[^;]*?),\s*['"](ild_\w+)['"]\s*,/g,
];

const callbacks = new Set();
for (const pattern of CALLBACK_PATTERNS) {
  for (const match of source.matchAll(pattern)) callbacks.add(match[1]);
}

const missing = [...callbacks].filter((name) => !defined.has(name));

if (missing.length) {
  console.error(`[plugin] hooked callbacks that do not exist: ${missing.join(", ")}`);
  process.exit(1);
}

const version = source.match(/^ \* Version:\s+(\S+)/m)?.[1] ?? "unknown";
console.log(
  `[plugin] v${version} — syntax OK, ${defined.size} functions, ${callbacks.size} callbacks all defined`
);
