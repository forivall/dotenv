/* @flow */
/*::

type DotenvParseOptions = {
  debug?: boolean
}

// keys and values from src
type DotenvParseOutput = { [string]: string }

type DotenvConfigOptions = {
  path?: string, // path to .env file
  encoding?: string, // encoding of .env file
  debug?: string // turn on logging for debugging purposes
}

type DotenvConfigOutput = {
  parsed?: DotenvParseOutput,
  error?: Error
}

*/

const fs = require('fs')
const path = require('path')

function log (message /*: string */) {
  console.log(`[dotenv][DEBUG] ${message}`)
}

const P = require('parsimmon')

const optWs = P.regex(/[ \f\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*/)
const parser = P.alt(
  P.seqObj(
    // matching "KEY' and 'VAL' in 'KEY=VAL'
    optWs,
    ['key', P.regexp(/[\w.-]+/)],
    optWs,
    P.string('='),
    optWs,
    ['value', P.alt(
      P.regexp(/"((?:\\.|[^"\\])*)"/, 1).desc('Double quoted (") string').map(
        // expand newlines in quoted values
        (result) => result.replace(/\\./g, (s) => {
          switch (s) {
            case '\\n': return '\n'
            case '\\r': return '\r'
            default: return s.charAt(1)
          }
        })
      ),
      P.regexp(/'((?:\\.|[^'\\])*)'/, 1).desc('Single quoted (\') string'),
      P.regexp(/[^\r\n]*/).map((result) => {
        return result.trim()
      })
    )],
    optWs
  ),
  P.regexp(/.*/).mark()
).sepBy(P.newline).skip(P.end)

// Parses src into an Object
function parse (src /*: string | Buffer */, options /*: ?DotenvParseOptions */) /*: DotenvParseOutput */ {
  const debug = Boolean(options && options.debug)
  // convert Buffers before and processing
  return parser.tryParse(src.toString()).reduce((obj, { key, value, start }) => {
    if (key) {
      obj[key] = value
    } else if (debug) {
      log(`did not match key and value when parsing line ${start.line}: ${value}`)
    }
    return obj
  }, {})
}

// Populates process.env from .env file
function config (options /*: ?DotenvConfigOptions */) /*: DotenvConfigOutput */ {
  let dotenvPath = path.resolve(process.cwd(), '.env')
  let encoding /*: string */ = 'utf8'
  let debug = false

  if (options) {
    if (options.path != null) {
      dotenvPath = options.path
    }
    if (options.encoding != null) {
      encoding = options.encoding
    }
    if (options.debug != null) {
      debug = true
    }
  }

  try {
    // specifying an encoding returns a string instead of a buffer
    const parsed = parse(fs.readFileSync(dotenvPath, { encoding }), { debug })

    Object.keys(parsed).forEach(function (key) {
      if (!process.env.hasOwnProperty(key)) {
        process.env[key] = parsed[key]
      } else if (debug) {
        log(`"${key}" is already defined in \`process.env\` and will not be overwritten`)
      }
    })

    return { parsed }
  } catch (e) {
    return { error: e }
  }
}

module.exports.config = config
module.exports.load = config
module.exports.parse = parse
