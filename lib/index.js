//
// index.js
// @trenskow/arguments-parser
//
// Created by Kristian Trenskow on 2026/08/04
// See license in LICENSE.
//

import {
	basename,
	extname
} from 'path';

import plugins from './plugins/index.js';

import argumentsParser from './arguments-parser.js';
import autocomplete from './autocomplete/index.js';

plugins();

if (process.argv[2] === '_completion') {

	let command = basename(process.env.COMPLETION_PATH || process.argv[1]);

	const ext = extname(command);

	if (ext.length) command = command.slice(0, -ext.length);

	autocomplete.script({
		shell: process.argv[3],
		command
	});

	process.exit(0);

}

export default typeof process.env.AUTOCOMPLETE_INDEX !== 'undefined' ? autocomplete() : argumentsParser;
